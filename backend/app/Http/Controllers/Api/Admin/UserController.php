<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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
                    ->orWhere('username', 'like', "%{$search}%")
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
            'name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'role' => ['required', Rule::in(UserRole::values())],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'username' => $data['username'],
            'email' => $data['email'],
            'role' => $data['role'],
            'password' => Hash::make($data['password']),
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        ActivityLog::record('user_created', "Created admin account: {$user->name} (@{$user->username})", $user->name);

        return (new UserResource($user))->response()->setStatusCode(201);
    }

    public function update(Request $request, User $user): UserResource|JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', 'max:150', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => ['required', Rule::in(UserRole::values())],
        ]);

        // Guard against self-lockout: you can't change your own role (activate /
        // deactivate has its own dedicated, self-protected endpoint).
        if ($this->isSelf($request, $user) && $data['role'] !== $user->role?->value) {
            return $this->reject('You cannot change your own role.');
        }

        $user->update([
            'name' => $data['name'],
            'username' => $data['username'],
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

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user->update(['password' => Hash::make($data['password'])]);

        ActivityLog::record('password_reset', "Reset the password for admin {$user->name}", $user->name);

        return response()->json(['ok' => true]);
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

    private function isSelf(Request $request, User $user): bool
    {
        return $request->user()?->id === $user->id;
    }

    private function reject(string $message): JsonResponse
    {
        return response()->json(['message' => $message], 422);
    }
}
