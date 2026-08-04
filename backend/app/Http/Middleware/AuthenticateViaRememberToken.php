<?php

namespace App\Http\Middleware;

use App\Services\RememberMeService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Transparently signs a guest back in from a "remember me" cookie once their
 * session has expired or been cleared — the read-side counterpart to
 * RememberMeService::issue(). Appended to the end of the `web` middleware
 * group, so it runs after the session has started and CSRF has already been
 * checked, but before route-level guards like `auth.session` / EnsureAdmin —
 * a successful cookie login looks, to everything downstream, exactly like a
 * session that was never idle.
 */
class AuthenticateViaRememberToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::guard('web')->check()) {
            $user = RememberMeService::attempt($request);

            if ($user) {
                Auth::guard('web')->login($user);
                $request->session()->regenerate();
                // A cookie revival is a genuine return — starts the 6-hour
                // inactivity clock fresh, same as a password login. See
                // EnforceIdleTimeout.
                $request->session()->put('last_meaningful_activity', now()->timestamp);
            }
        }

        return $next($request);
    }
}
