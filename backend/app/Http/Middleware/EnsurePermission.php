<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

/**
 * Route-level authorization for the JSON admin API. Runs after EnsureAdmin (so
 * the caller is a signed-in, active account) and requires the given permission,
 * answering with a 403 JSON so the React admin can react rather than follow an
 * HTML redirect.
 *
 * Usage: ->middleware('permission:members.edit'). The ability names come from
 * {@see \App\Enums\Permission} and are backed by Gates in AppServiceProvider.
 */
class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (! $request->user() || Gate::denies($permission)) {
            return response()->json(['message' => 'You are not allowed to perform this action.'], 403);
        }

        return $next($request);
    }
}
