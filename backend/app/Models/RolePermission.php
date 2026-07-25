<?php

namespace App\Models;

use App\Enums\Permission;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\QueryException;

/**
 * The editable permission matrix. One row per role that the Programming Team has
 * customized from the Privileges panel, holding that role's complete ability
 * list; roles without a row fall back to the defaults declared in code.
 *
 * Only abilities marked {@see Permission::isEditable()} can actually be moved —
 * today that is paid/unpaid alone. The rest are pinned to the code defaults on
 * every read, so widening the panel later is a change to that one method rather
 * than to anything here.
 *
 * Everything that authorizes — the Gates, the `permission:*` middleware, the
 * ability list handed to the React admin — reads through {@see self::resolve()},
 * so a change here takes effect everywhere at once.
 */
class RolePermission extends Model
{
    protected $fillable = ['role', 'permissions'];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }

    /**
     * Stored overrides, read once per request. Authorization asks for a role's
     * abilities many times while handling a single request (route middleware,
     * controller checks, the resource that renders the response), and they can't
     * change midway, so one query serves them all.
     *
     * Scoped to the process, which under PHP-FPM is exactly one request. Anywhere
     * a process outlives a request — a queue worker, Octane — call
     * {@see self::flush()} at the start of the unit of work, as the test suite
     * does in Tests\TestCase::setUp().
     *
     * @var array<string, list<string>>|null
     */
    private static ?array $memo = null;

    /** Drop the memo after a write, so the same request sees its own change. */
    public static function flush(): void
    {
        self::$memo = null;
    }

    /**
     * The abilities a role actually holds right now: its stored override if the
     * Programming Team has customized it, otherwise the shipped defaults —
     * with locked abilities forced back to what code says regardless.
     *
     * @return list<Permission>
     */
    public static function resolve(UserRole $role): array
    {
        $stored = self::overrides()[$role->value] ?? null;

        return self::normalize(
            $role,
            $stored === null ? $role->defaultPermissions() : self::toPermissions($stored),
        );
    }

    /**
     * What a role *would* hold if the given list were saved — the same pipeline
     * as {@see self::resolve()}, writing nothing.
     *
     * Lets the controller judge a change before it lands, which matters for the
     * ones there is no way back from: revoking account management from the last
     * officer who holds it cannot be undone through the UI that just did it.
     *
     * @param  list<string>  $values
     * @return list<Permission>
     */
    public static function preview(UserRole $role, array $values): array
    {
        return self::normalize($role, self::toPermissions($values));
    }

    /** What a role would hold once reset to the defaults declared in code. */
    public static function previewReset(UserRole $role): array
    {
        return self::normalize($role, $role->defaultPermissions());
    }

    /**
     * Pin the abilities the panel does not own, then drop any whose prerequisite
     * did not survive. Shared so a preview and a real read can never disagree.
     *
     * @param  list<Permission>  $permissions
     * @return list<Permission>
     */
    private static function normalize(UserRole $role, array $permissions): array
    {
        return self::dropUnmetPrerequisites(self::forceFixed($role, $permissions));
    }

    /**
     * Unknown strings — an ability removed from the enum since a row was written
     * — are dropped rather than fataling.
     *
     * @param  array<int, mixed>  $values
     * @return list<Permission>
     */
    private static function toPermissions(array $values): array
    {
        return array_values(array_filter(array_map(
            static fn (mixed $value): ?Permission => is_string($value) ? Permission::tryFrom($value) : null,
            $values,
        )));
    }

    /**
     * The effective matrix for every role, as raw values — what the Privileges
     * panel loads.
     *
     * @return array<string, list<string>>
     */
    public static function matrix(): array
    {
        $matrix = [];

        foreach (UserRole::cases() as $role) {
            $matrix[$role->value] = array_map(
                static fn (Permission $p): string => $p->value,
                self::resolve($role),
            );
        }

        return $matrix;
    }

    /**
     * Replace a role's abilities with the given list, and return what the role
     * effectively holds afterwards.
     *
     * The whole submitted set is stored, fixed abilities included, even though
     * {@see self::forceFixed()} will override them on read. Storing only the
     * editable ones would make "absent" mean "use the default" — and the day an
     * ability became editable, every existing row would silently start reading
     * as a revocation of it. Recording what the panel actually showed keeps old
     * rows meaning the same thing after the editable set widens.
     *
     * Unknown values are dropped, so a stale client can't write junk.
     *
     * @param  list<string>  $values
     * @return list<Permission>
     */
    public static function grant(UserRole $role, array $values): array
    {
        $keep = array_values(array_unique(array_filter(
            $values,
            static fn (mixed $value): bool => is_string($value) && Permission::tryFrom($value) !== null,
        )));

        self::updateOrCreate(['role' => $role->value], ['permissions' => $keep]);
        self::flush();

        return self::resolve($role);
    }

    /** Has this role been customized, or is it still on the shipped defaults? */
    public static function isCustomized(UserRole $role): bool
    {
        return array_key_exists($role->value, self::overrides());
    }

    /**
     * Drop a role's override so it returns to the defaults declared in code.
     *
     * @return list<Permission>
     */
    public static function reset(UserRole $role): array
    {
        self::query()->where('role', $role->value)->delete();
        self::flush();

        return self::resolve($role);
    }

    /* ---------------------------------------------------------------- internals */

    /**
     * @return array<string, list<string>>
     */
    private static function overrides(): array
    {
        if (self::$memo !== null) {
            return self::$memo;
        }

        try {
            return self::$memo = self::query()
                ->pluck('permissions', 'role')
                ->map(static fn (mixed $values): array => is_array($values) ? $values : [])
                ->all();
        } catch (QueryException) {
            // Authorization runs through here on every admin request, so a
            // missing table (code deployed ahead of its migration) would take
            // the whole admin down rather than just this one panel. Fall back to
            // the defaults declared in code — the behaviour before this feature
            // existed — and memoize so we don't retry per check.
            return self::$memo = [];
        }
    }

    /**
     * Every ability the Privileges panel does not own is pinned back to what
     * {@see UserRole::defaultPermissions()} says — so today a stored row can
     * only ever move paid/unpaid, and `users.manage` in particular stays with
     * the Programming Team. Applied on read, so even a hand-edited database row
     * cannot hand out an ability the panel was never allowed to grant.
     *
     * @param  list<Permission>  $permissions
     * @return list<Permission>
     */
    private static function forceFixed(UserRole $role, array $permissions): array
    {
        $defaults = $role->defaultPermissions();

        // Walking the cases rather than the stored list also settles the order
        // and drops duplicates, so the API, the panel and the activity log all
        // read the same way however a row was written.
        return array_values(array_filter(
            Permission::cases(),
            static fn (Permission $p): bool => $p->isEditable()
                ? in_array($p, $permissions, true)
                : in_array($p, $defaults, true),
        ));
    }

    /**
     * Remove any ability whose prerequisite is missing — granting `members.edit`
     * without `members.view` would be a promise the routes refuse to keep, so
     * the effective set never contains one.
     *
     * Looped rather than done in a single pass so a chain of prerequisites
     * collapses correctly if one is ever added.
     *
     * @param  list<Permission>  $permissions
     * @return list<Permission>
     */
    private static function dropUnmetPrerequisites(array $permissions): array
    {
        do {
            $before = count($permissions);

            $permissions = array_values(array_filter(
                $permissions,
                static function (Permission $p) use ($permissions): bool {
                    $required = $p->requires();

                    return $required === null || in_array($required, $permissions, true);
                },
            ));
        } while (count($permissions) < $before);

        return $permissions;
    }
}
