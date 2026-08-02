<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for the JSON admin API. Enforces the same rule as Filament's panel —
 * a signed-in officer whose account may access the admin (User::canAccessAdmin)
 * — but answers with JSON so the React admin can react instead of following a
 * redirect to an HTML login page.
 */
class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var User|null $user */
        $user = Auth::guard('web')->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->canAccessAdmin()) {
            // Same wording as AdminAuthController::login's rejection — this is
            // the same condition (canAccessAdmin() is just is_active), hit
            // mid-session instead of at the login form (e.g. deactivated
            // while signed in elsewhere).
            return response()->json([
                'message' => 'This account has been deactivated. Contact an administrator for access.',
            ], 403);
        }

        // An account still on its system-generated first-login password gets
        // exactly two doors: reading who it is, and setting a real password.
        // Enforced here rather than left to the frontend's own redirect, so a
        // direct API call can't reach the rest of the admin either.
        if ($user->must_change_password && ! $request->routeIs('admin.api.me', 'admin.api.me.password.update')) {
            return response()->json([
                'message' => 'You must change your password before continuing.',
                'mustChangePassword' => true,
            ], 423);
        }

        return $next($request);
    }
}
