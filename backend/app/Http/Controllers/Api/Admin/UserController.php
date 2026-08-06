<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\RememberMeService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * User Management — CRUD over administrator accounts, plus activate/deactivate,
 * permanent delete and password reset. Reachable only by roles that may manage
 * users (the `permission:users.manage` middleware on the route group).
 *
 * Every account-management action is written to the Activity Log with a precise
 * description, since these are exactly the events an audit most needs to see.
 * Deactivation (reversible) is the everyday "remove"; permanent delete is the
 * escape hatch. An administrator can never deactivate or delete their own
 * signed-in account.
 */
class UserController extends Controller
{
    /** Days that must pass between two resets of the same account. */
    private const RESET_COOLDOWN_DAYS = 7;

    /** Columns the list may be sorted by, mapped to real DB columns. */
    private const SORTABLE = [
        'name' => 'name',
        'role' => 'role',
        'lastLogin' => 'last_login_at',
        'createdAt' => 'created_at',
    ];

    /* ------------------------------------------------------------------ read */

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::query();

        if (($role = $request->query('role')) && in_array($role, UserRole::values(), true)) {
            $query->where('role', $role);
        }

        match ($request->query('status')) {
            'active' => $query->where('is_active', true),
            'inactive' => $query->where('is_active', false),
            default => $query,
        };

        if ($search = trim((string) $request->query('search'))) {
            // whereLike(..., caseSensitive: false) compiles to ILIKE on Postgres
            // and a LOWER() comparison elsewhere, so this stays case-insensitive
            // on both the sqlite test DB and the Supabase/Postgres database.
            $query->where(function (Builder $q) use ($search): void {
                $q->whereLike('name', "%{$search}%", caseSensitive: false)
                    ->orWhereLike('first_name', "%{$search}%", caseSensitive: false)
                    ->orWhereLike('last_name', "%{$search}%", caseSensitive: false)
                    ->orWhereLike('email', "%{$search}%", caseSensitive: false);
            });
        }

        $sort = self::SORTABLE[$request->query('sort')] ?? 'created_at';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction);

        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        return UserResource::collection($query->paginate($perPage)->withQueryString());
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    /* ----------------------------------------------------------------- writes */

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_initial' => ['nullable', 'string', 'max:1'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'role' => ['required', Rule::in(UserRole::values())],
        ]);

        // Normalized here too, not only in the form — a name typed in all caps
        // or all lowercase (or hit directly through the API) reads the same
        // way everywhere it is shown.
        $data['first_name'] = $this->titleCase($data['first_name']);
        $data['last_name'] = $this->titleCase($data['last_name']);
        if (! empty($data['middle_initial'])) {
            $data['middle_initial'] = mb_strtoupper($data['middle_initial']);
        }

        // The account form no longer asks for a password — the system picks
        // one, the officer is forced to replace it the first time they sign
        // in (see MeController::updatePassword and EnsureAdmin), and it is
        // handed back once below so whoever created the account can pass it
        // along. Signing in is already by email (AdminAuthController::login),
        // so there is no separate "username" to generate.
        $defaultPassword = $this->generateDefaultPassword();

        $user = User::create([
            'name' => $this->composeName($data),
            'first_name' => $data['first_name'],
            'middle_initial' => $data['middle_initial'] ?? null,
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'role' => $data['role'],
            'password' => Hash::make($defaultPassword),
            'must_change_password' => true,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        ActivityLog::record('user_created', "Created admin account: {$user->name}", $user->name);

        return response()->json([
            'data' => (new UserResource($user))->resolve($request),
            // Shown once, in the "account created" panel — never persisted or
            // logged in plaintext anywhere past this response.
            'generatedPassword' => $defaultPassword,
        ], 201);
    }

    public function update(Request $request, User $user): UserResource|JsonResponse
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_initial' => ['nullable', 'string', 'max:1'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in(UserRole::values())],
        ]);

        $data['first_name'] = $this->titleCase($data['first_name']);
        $data['last_name'] = $this->titleCase($data['last_name']);
        if (! empty($data['middle_initial'])) {
            $data['middle_initial'] = mb_strtoupper($data['middle_initial']);
        }

        // Guard against self-lockout: you can't change your own role (activate /
        // deactivate has its own dedicated, self-protected endpoint).
        if ($this->isSelf($request, $user) && $data['role'] !== $user->role?->value) {
            return $this->reject('You cannot change your own role.');
        }

        $user->update([
            'name' => $this->composeName($data),
            'first_name' => $data['first_name'],
            'middle_initial' => $data['middle_initial'] ?? null,
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'role' => $data['role'],
        ]);

        ActivityLog::record('user_updated', "Edited {$user->name}'s admin account", $user->name);

        return new UserResource($user->fresh());
    }

    /** Activate or deactivate (reversible) — the everyday alternative to delete. */
    public function toggleActive(Request $request, User $user): UserResource|JsonResponse
    {
        if ($this->isSelf($request, $user)) {
            return $this->reject('You cannot deactivate your own account while signed in.');
        }

        // Flips whatever the row's value is *at the moment this statement
        // runs*, computed by the database in one atomic UPDATE — not
        // `! $user->is_active`, which would flip whatever this request
        // happened to load earlier. Two admins toggling the same account at
        // nearly the same instant would otherwise both read the same
        // starting value and race to the same result (a lost update); this
        // way each UPDATE inverts the row as it actually stands, so two
        // overlapping toggles still compose correctly.
        User::whereKey($user->id)->update(['is_active' => DB::raw('NOT is_active')]);
        $user->refresh();

        $user->is_active
            ? ActivityLog::record('user_activated', "Activated admin {$user->name}", $user->name)
            : ActivityLog::record('user_deactivated', "Deactivated admin {$user->name}", $user->name);

        return new UserResource($user);
    }

    /**
     * Put the account back into the same first-login state a newly created one
     * starts in: a fresh, random system-generated password (see
     * {@see self::generateDefaultPassword()}) and
     * {@see \App\Models\User::$must_change_password} forced back on so it
     * must be replaced before anything else. Everything else on the account —
     * name, email, role — is untouched.
     *
     * Deliberately not "let the officer resetting it type in a password of
     * their choosing": that password is one more secret that has to be handed
     * over safely, where a generated one that must be replaced on first sign-in
     * never needs to stay secret past that moment.
     *
     * Rate-limited to once every {@see self::RESET_COOLDOWN_DAYS} per account —
     * resetting signs the account out everywhere (see below), so back-to-back
     * resets are also a way to repeatedly lock a coworker out.
     */
    public function resetPassword(User $user): JsonResponse
    {
        $availableAt = self::resetAvailableAt($user);

        if ($availableAt?->isFuture()) {
            return response()->json([
                'message' => "This account was already reset recently. Try again after {$availableAt->format('M j, Y g:i A')}.",
                'availableAt' => $availableAt->toIso8601String(),
            ], 422);
        }

        $defaultPassword = $this->generateDefaultPassword();

        $user->update([
            'password' => Hash::make($defaultPassword),
            'must_change_password' => true,
            'password_reset_at' => now(),
        ]);

        // Kill every session this account already has open — a reset means
        // the old password (and whatever was signed in under it) shouldn't
        // get to linger until it happens to hit auth.session's stale-hash
        // check on its own next request.
        DB::table('sessions')->where('user_id', $user->id)->delete();
        RememberMeService::forgetAllForUser($user->id);

        ActivityLog::record('password_reset', "Reset the password for admin {$user->name}", $user->name);

        return response()->json([
            'ok' => true,
            // Shown once, the same as the password a newly created account
            // gets — never persisted or logged in plaintext past this response.
            'generatedPassword' => $defaultPassword,
        ]);
    }

    /**
     * "Log out all admins" — the kill switch for when a change (a role's
     * permissions, an account's own role, this feature itself) needs to take
     * effect everywhere without messaging every officer to sign out and back
     * in. Ends every session and revokes every remember-me token on every
     * administrator account except the one making this request, so whoever
     * clicked it stays signed in to see the result.
     *
     * Scoped by user_id, not by session id/cookie: the caller may well be
     * signed in on more than one device, and all of those are "the one
     * making this request" too, not just the tab that happened to click the
     * button.
     */
    public function logoutAllAdminSessions(Request $request): JsonResponse
    {
        DB::table('sessions')
            ->where('user_id', '!=', $request->user()->id)
            ->delete();

        RememberMeService::forgetAllExcept($request->user()->id);

        ActivityLog::record(
            'users_logged_out_all',
            "{$request->user()->name} signed every other administrator out",
        );

        return response()->json(['ok' => true]);
    }

    /**
     * Permanent, irreversible removal.
     *
     * Gated by the same `permission:users.manage` as every other route in
     * this group (see routes/admin.php) — there is no separate "Super Admin"
     * tier that reserves this one action to a smaller set of accounts than
     * the rest of User Management. The only account-specific guard here is
     * {@see self::isSelf()} below: whoever holds users.manage may delete any
     * *other* administrator, just never their own signed-in account.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($this->isSelf($request, $user)) {
            return $this->reject('You cannot delete your own account.');
        }

        $name = $user->name;
        $user->delete();

        ActivityLog::record('user_deleted', "Permanently deleted admin {$name}", $name);

        return response()->json(['ok' => true]);
    }

    /* ---------------------------------------------------------------- helpers */

    /**
     * The displayed full name, composed from the parts the form now captures —
     * "Juan S. Dela Cruz". Kept in the `name` column so every screen and log
     * line that shows an officer's name is unchanged.
     *
     * @param  array{first_name:string,middle_initial?:?string,last_name:string}  $data
     */
    private function composeName(array $data): string
    {
        $middle = trim((string) ($data['middle_initial'] ?? ''));
        $middle = $middle === '' ? '' : mb_strtoupper($middle).'. ';

        return trim($data['first_name'].' '.$middle.$data['last_name']);
    }

    /**
     * The first-login password a newly created (or reset) account starts
     * with — a fresh, cryptographically random 16-character string (letters,
     * numbers and symbols), not derived from anything about the account.
     *
     * Deliberately not built from the officer's name the way an earlier
     * version of this did ("first.last.m"): a name is public/knowable
     * information, not a secret, so anyone who knew how an officer's name is
     * spelled could sign in as them during the window before their real
     * first login — no guessing required, which meant the account-lockout
     * protections elsewhere in this app (rate limiting, etc.) never even
     * came into play. Random generation on every call also means no two
     * accounts, and no two resets of the same account, ever share a
     * password. The officer is forced to replace it before doing anything
     * else (see `must_change_password`), so this only ever needs to get them
     * to that screen — it's never a password anyone keeps.
     */
    private function generateDefaultPassword(): string
    {
        return Str::password(16);
    }

    /** "jUAN dela  CRUZ" → "Juan Dela Cruz" — normalized regardless of how it arrived. */
    private function titleCase(string $value): string
    {
        return mb_convert_case(trim($value), MB_CASE_TITLE, 'UTF-8');
    }

    /**
     * When this account's reset-password cooldown ends, or null if it has
     * never been reset (or the cooldown has already passed). Shared by the
     * write path above and the list's `resetAvailableAt` column, so both read
     * the same 7-day window off the same `password_reset_at` timestamp.
     */
    public static function resetAvailableAt(User $user): ?\Illuminate\Support\Carbon
    {
        if (! $user->password_reset_at) {
            return null;
        }

        $availableAt = $user->password_reset_at->copy()->addDays(self::RESET_COOLDOWN_DAYS);

        return $availableAt->isFuture() ? $availableAt : null;
    }

    private function isSelf(Request $request, User $user): bool
    {
        return $request->user()?->id === $user->id;
    }

    private function reject(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }
}
