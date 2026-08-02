<?php

namespace App\Http\Controllers;

use App\Services\RememberMeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Signs officers in from the site's own login modal, so they never have to
 * leave the landing page. Filament's own login page still works and remains
 * the fallback; this is a second door onto the same session guard.
 */
class AdminAuthController extends Controller
{
    /** Attempts allowed per email+IP before the throttle kicks in. */
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    /**
     * Hands the frontend a CSRF token, and (as a side effect of the web
     * middleware) starts the session the login POST will be validated against.
     */
    public function csrf(Request $request): JsonResponse
    {
        return response()->json(['token' => csrf_token()]);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $key = $this->throttleKey($request, $credentials['email']);

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            return response()->json([
                'message' => 'Too many attempts. Try again in '
                    .RateLimiter::availableIn($key).' seconds.',
            ], 429);
        }

        // The "remember" flag is handled entirely by RememberMeService below,
        // not Laravel's own recaller cookie (Auth::attempt()'s second
        // argument) — see that service's docblock for why.
        if (! Auth::guard('web')->attempt($credentials)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);

            return response()->json(['message' => 'Those credentials do not match our records.'], 422);
        }

        // A valid password is not enough if the account is not permitted into
        // the admin — otherwise we would leave a signed-in session behind for
        // someone EnsureAdmin would turn away on the next request.
        if (! Auth::user()->canAccessAdmin()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            RateLimiter::hit($key, self::DECAY_SECONDS);

            return response()->json(['message' => 'This account cannot access the admin.'], 403);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        // A session that was last authenticated as someone else (a shared
        // computer, a browser never explicitly signed out of) can still be
        // carrying that account's password hash — see the 'auth.session'
        // alias in bootstrap/app.php. regenerate() rotates the session id but
        // does not touch this key, so a stale value here would read as this
        // fresh login already having gone bad the moment the next request
        // checks it. Forgetting it lets 'auth.session' re-prime itself for
        // whoever just signed in.
        $request->session()->forget('password_hash_web');

        // Starts the 6-hour inactivity clock fresh — see EnforceIdleTimeout.
        $request->session()->put('last_meaningful_activity', now()->timestamp);

        // Only one signed-in session per officer: drop every other row this
        // account owns in the `sessions` table (requires SESSION_DRIVER=database)
        // so a device that was already logged in gets treated as a guest on
        // its next request, instead of two sessions being active at once.
        DB::table('sessions')
            ->where('user_id', Auth::id())
            ->where('id', '!=', $request->session()->getId())
            ->delete();

        // Same "one signed-in device" reasoning, extended to the remember-me
        // cookie: a fresh sign-in starts clean rather than trusting whatever
        // an earlier session on this or another device was issued.
        RememberMeService::forgetAllForUser(Auth::id());

        if ($request->boolean('remember')) {
            RememberMeService::issue(Auth::user(), $request);
        }

        // Land officers in the React admin on the public site's own origin.
        return response()->json(['redirect' => rtrim(config('app.frontend_url'), '/').'/admin']);
    }

    /**
     * Sign the officer out and hand back the landing-page URL, mirroring the
     * Filament panel's logout (session invalidated, CSRF token regenerated,
     * returned to the public site). Safe to call even without a live session.
     */
    public function logout(Request $request): JsonResponse
    {
        // Revokes the remember-me cookie's token too — signing out is
        // meaningless if the same browser gets logged back in on its next
        // request via RememberMeService::attempt().
        RememberMeService::forgetCurrent($request);

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['redirect' => config('app.frontend_url')]);
    }

    private function throttleKey(Request $request, string $email): string
    {
        return 'admin-login|'.Str::lower($email).'|'.$request->ip();
    }
}
