<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\RolePermission;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Privileges — the editable role→permission matrix behind User Management's
 * per-row "Privileges" action.
 *
 * A grant belongs to the *role*, not the account it was opened from: ticking
 * "Update payment status" on a President's row lets every President account
 * mark members paid. The row is only the entry point, which is why the panel
 * states the role it is editing and how many accounts hold it.
 *
 * Every ability is editable (see {@see Permission::isEditable()}) — there is
 * no fixed subset shown read-only, and `isEditable()`'s `false` branch is
 * dead code today, kept only so an ability added later starts locked until
 * someone deliberately opts it in.
 *
 * Reachable only by roles that may manage users (the `permission:users.manage`
 * middleware on the route group) — which means a holder of that ability *can*
 * use this module to grant it to another role, `users.manage` included; there
 * is no separate tier above it that this panel keeps out of reach. What this
 * module refuses is narrower and different: a change that would strip account
 * management from the officer making it, or leave no active account holding
 * it anywhere — see {@see self::refuseLockout()}. That guards against locking
 * everyone out, not against handing the ability out in the first place.
 */
class RolePermissionController extends Controller
{
    /** The whole matrix plus the ability catalog — one fetch for the panel. */
    public function index(): JsonResponse
    {
        return response()->json([
            'permissions' => Permission::catalog(),
            'roles' => $this->roles(),
        ]);
    }

    /** Replace one role's abilities. Locked abilities are ignored, not rejected. */
    public function update(Request $request, string $role): JsonResponse
    {
        $target = UserRole::tryFrom($role);

        if (! $target) {
            return response()->json(['message' => 'Unknown role.'], 404);
        }

        $data = $request->validate([
            'permissions' => ['present', 'array'],
            'permissions.*' => [Rule::in(Permission::values())],
        ]);

        if ($refusal = $this->refuseLockout($request, $target, RolePermission::preview($target, $data['permissions']))) {
            return $refusal;
        }

        $before = $target->permissions();
        $after = RolePermission::grant($target, $data['permissions']);

        $this->log($target, $before, $after);

        return response()->json($this->role($target, $this->accountCounts()));
    }

    /** Put a role back on the defaults declared in code. */
    public function reset(Request $request, string $role): JsonResponse
    {
        $target = UserRole::tryFrom($role);

        if (! $target) {
            return response()->json(['message' => 'Unknown role.'], 404);
        }

        // A reset is still a change, and can strand account management just as
        // easily — a role granted it whose defaults do not include it loses it.
        if ($refusal = $this->refuseLockout($request, $target, RolePermission::previewReset($target))) {
            return $refusal;
        }

        $before = $target->permissions();
        $after = RolePermission::reset($target);

        $this->log($target, $before, $after, reset: true);

        return response()->json($this->role($target, $this->accountCounts()));
    }

    /* ----------------------------------------------------------- lockout guard */

    /**
     * Refuse a change that would take account management away from the officer
     * making it, or leave no active account holding it anywhere.
     *
     * Every other ability can be handed back by whoever still holds this one.
     * This one has no such backstop: revoke it from the last role that has it
     * and the Privileges panel — the only place to undo that — is gone with it,
     * leaving the database as the sole way back in. So it is the one change the
     * module will not make, however it is asked.
     *
     * @param  list<Permission>  $after  what the role would hold once saved
     */
    private function refuseLockout(Request $request, UserRole $target, array $after): ?JsonResponse
    {
        $keepsIt = in_array(Permission::ManageUsers, $after, true);

        if (! $keepsIt && $request->user()?->role === $target) {
            return $this->reject(
                'You cannot remove account management from your own role — you would lose the ability to put it back. Ask another administrator, or move it to a different role first.'
            );
        }

        if (! $keepsIt && ! $this->someoneElseCanManage($target)) {
            return $this->reject(
                'At least one active account must keep account management, otherwise nobody could reach User Management again.'
            );
        }

        return null;
    }

    /**
     * Is there an active account, outside the role being changed, whose role
     * still holds account management?
     */
    private function someoneElseCanManage(UserRole $target): bool
    {
        $roles = array_values(array_filter(
            UserRole::cases(),
            static fn (UserRole $role): bool => $role !== $target
                && in_array(Permission::ManageUsers, $role->permissions(), true),
        ));

        if ($roles === []) {
            return false;
        }

        // A role nobody holds is no safety net, so the account must exist and be
        // able to sign in.
        return User::query()
            ->whereIn('role', array_map(static fn (UserRole $r): string => $r->value, $roles))
            ->where('is_active', true)
            ->exists();
    }

    private function reject(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }

    /* ---------------------------------------------------------------- helpers */

    /** @return list<array<string, mixed>> */
    private function roles(): array
    {
        $counts = $this->accountCounts();

        return array_map(fn (UserRole $role): array => $this->role($role, $counts), UserRole::cases());
    }

    /**
     * @param  array<string, int>  $counts
     * @return array<string, mixed>
     */
    private function role(UserRole $role, array $counts): array
    {
        return [
            'value' => $role->value,
            'label' => $role->label(),
            'permissions' => $this->values($role->permissions()),
            'defaults' => $this->values($role->defaultPermissions()),
            // Lets the panel offer "reset to defaults" only where it would do
            // something, and flag roles that have been changed from the shipped
            // matrix.
            'customized' => RolePermission::isCustomized($role),
            'accountCount' => $counts[$role->value] ?? 0,
        ];
    }

    /**
     * @param  list<Permission>  $permissions
     * @return list<string>
     */
    private function values(array $permissions): array
    {
        return array_map(static fn (Permission $p): string => $p->value, $permissions);
    }

    /**
     * How many administrator accounts hold each role — the panel warns how far a
     * change reaches before it is saved.
     *
     * @return array<string, int>
     */
    private function accountCounts(): array
    {
        return User::query()
            ->selectRaw('role, count(*) as aggregate')
            ->groupBy('role')
            ->pluck('aggregate', 'role')
            ->map(static fn (mixed $count): int => (int) $count)
            ->all();
    }

    /**
     * Write the change to the Activity Log naming the abilities that moved —
     * "who could suddenly do what" is exactly what an audit of this module needs
     * to answer, and a bare "privileges updated" would not.
     *
     * @param  list<Permission>  $before
     * @param  list<Permission>  $after
     */
    private function log(UserRole $role, array $before, array $after, bool $reset = false): void
    {
        $granted = $this->labels(array_udiff($after, $before, $this->compare()));
        $revoked = $this->labels(array_udiff($before, $after, $this->compare()));

        if (! $granted && ! $revoked) {
            return;
        }

        $parts = [];

        if ($granted) {
            $parts[] = 'granted '.implode(', ', $granted);
        }

        if ($revoked) {
            $parts[] = 'revoked '.implode(', ', $revoked);
        }

        $suffix = $reset ? ' (reset to defaults)' : '';

        ActivityLog::record(
            'privileges_updated',
            "Privileges for {$role->label()}: ".implode('; ', $parts).$suffix,
            $role->label(),
        );
    }

    /**
     * @param  array<int, Permission>  $permissions
     * @return list<string>
     */
    private function labels(array $permissions): array
    {
        return array_values(array_map(static fn (Permission $p): string => $p->label(), $permissions));
    }

    /** array_udiff needs a comparator; enum cases sort fine by their value. */
    private function compare(): callable
    {
        return static fn (Permission $a, Permission $b): int => strcmp($a->value, $b->value);
    }
}
