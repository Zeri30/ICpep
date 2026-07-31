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
            $query->where(function (Builder $q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
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
        $defaultPassword = $this->generateDefaultPassword($data);

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

        $user->update(['is_active' => ! $user->is_active]);

        $user->is_active
            ? ActivityLog::record('user_activated', "Activated admin {$user->name}", $user->name)
            : ActivityLog::record('user_deactivated', "Deactivated admin {$user->name}", $user->name);

        return new UserResource($user->fresh());
    }

    /**
     * Put the account back into the same first-login state a newly created one
     * starts in: a fresh system-generated password, built from the account's
     * own name the same way {@see self::generateDefaultPassword()} builds one
     * at creation, and {@see \App\Models\User::$must_change_password} forced
     * back on so it must be replaced before anything else. Everything else on
     * the account — name, email, role — is untouched.
     *
     * Deliberately not "let the officer resetting it type in a password of
     * their choosing": that password is one more secret that has to be handed
     * over safely, where a generated one that must be replaced on first sign-in
     * never needs to stay secret past that moment.
     */
    public function resetPassword(User $user): JsonResponse
    {
        $defaultPassword = $this->generateDefaultPassword([
            'first_name' => (string) $user->first_name,
            'middle_initial' => $user->middle_initial,
            'last_name' => (string) $user->last_name,
        ]);

        $user->update([
            'password' => Hash::make($defaultPassword),
            'must_change_password' => true,
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

    /** Permanent, irreversible removal. Super-Admin only (route middleware). */
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
     * The first-login password a newly created account starts with —
     * "first.last.m", or "first.last" when there's no middle initial (the
     * same name parts {@see self::composeName()} builds the display name
     * from). Lowercased throughout and with the spaces stripped out of
     * whichever part has them (a first or last name of more than one word),
     * so the password an officer is read out or hands over is always one
     * simple, unspaced token per part. The officer is forced to replace it
     * before doing anything else.
     *
     * @param  array{first_name:string,middle_initial?:?string,last_name:string}  $data
     */
    private function generateDefaultPassword(array $data): string
    {
        $middle = trim((string) ($data['middle_initial'] ?? ''));

        return mb_strtolower(implode('.', array_filter([
            $this->collapseSpaces($data['first_name']),
            $this->collapseSpaces($data['last_name']),
            $middle === '' ? null : $middle,
        ])));
    }

    /** "Mark  Arone " → "MarkArone" — every space gone, not just the outer ones. */
    private function collapseSpaces(string $value): string
    {
        return str_replace(' ', '', trim($value));
    }

    /** "jUAN dela  CRUZ" → "Juan Dela Cruz" — normalized regardless of how it arrived. */
    private function titleCase(string $value): string
    {
        return mb_convert_case(trim($value), MB_CASE_TITLE, 'UTF-8');
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
