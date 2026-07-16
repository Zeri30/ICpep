<?php

namespace App\Http\Middleware;

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
        if (! Auth::guard('web')->check()) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! Auth::guard('web')->user()->canAccessAdmin()) {
            return response()->json(['message' => 'This account cannot access the admin.'], 403);
        }

        return $next($request);
    }
}
