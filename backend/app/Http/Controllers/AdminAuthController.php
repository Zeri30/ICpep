<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\User;
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
     * Attempts allowed from a single IP regardless of which email it's
     * trying, before every login from that IP is throttled. Catches
     * credential spraying (many different accounts, one guessed password
     * apiece) that the email+IP key above never sees — each new email
     * resets that pairing's own counter to zero.
     */
    private const IP_MAX_ATTEMPTS = 20;

    private const IP_DECAY_SECONDS = 300;

    /**
     * Attempts allowed against a single email regardless of which IP it
     * comes from, before that account is throttled. Catches a distributed
     * brute force (one account, rotating IPs) that the email+IP key above
     * never sees — each new IP starts that pairing's own counter fresh.
     */
    private const EMAIL_MAX_ATTEMPTS = 10;

    private const EMAIL_DECAY_SECONDS = 900;

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
        $ipKey = $this->ipThrottleKey($request);
        $emailKey = $this->emailThrottleKey($credentials['email']);

        // Whichever of the three keys is furthest from resetting decides the
        // wait — a single generic message either way, so a caller learns
        // nothing about which limiter (theirs, their IP's, or the account's)
        // is the one actually blocking them.
        $retryAfter = 0;
        foreach ([[$key, self::MAX_ATTEMPTS], [$ipKey, self::IP_MAX_ATTEMPTS], [$emailKey, self::EMAIL_MAX_ATTEMPTS]] as [$throttled, $max]) {
            if (RateLimiter::tooManyAttempts($throttled, $max)) {
                $retryAfter = max($retryAfter, RateLimiter::availableIn($throttled));
            }
        }

        if ($retryAfter > 0) {
            return response()->json([
                'message' => "Too many attempts. Try again in {$retryAfter} seconds.",
            ], 429);
        }

        // The "remember" flag is handled entirely by RememberMeService below,
        // not Laravel's own recaller cookie (Auth::attempt()'s second
        // argument) — see that service's docblock for why.
        if (! Auth::guard('web')->attempt($credentials)) {
            RateLimiter::hit($key, self::DECAY_SECONDS);
            RateLimiter::hit($ipKey, self::IP_DECAY_SECONDS);
            RateLimiter::hit($emailKey, self::EMAIL_DECAY_SECONDS);

            // Not ActivityLog::record() — that tags the *signed-in* user, and
            // there isn't one here. The attempted email is the one thing
            // worth recording: it's what an audit needs to tell a mistyped
            // password from a stranger trying accounts one at a time.
            ActivityLog::create([
                'actor' => $credentials['email'],
                'ip_address' => $request->ip(),
                'action' => 'login_failed',
                'description' => 'Failed sign-in attempt: incorrect credentials.',
            ]);

            return response()->json(['message' => 'Those credentials do not match our records.'], 422);
        }

        // A valid password is not enough if the account is not permitted into
        // the admin — otherwise we would leave a signed-in session behind for
        // someone EnsureAdmin would turn away on the next request.
        //
        // canAccessAdmin() is just is_active today (see User::canAccessAdmin),
        // so failing here always means one specific thing — say so plainly
        // rather than the vaguer "cannot access the admin", which read like a
        // permissions problem rather than a deactivated account.
        //
        // attempt() just succeeded, so a user is guaranteed to be signed in —
        // Auth::user() is typed to the generic Authenticatable contract,
        // which doesn't declare canAccessAdmin(), so this app-specific
        // subclass is spelled out for the type checker (see EnsureAdmin for
        // the same annotation).
        /** @var User $user */
        $user = Auth::user();

        if (! $user->canAccessAdmin()) {
            // The credentials were correct — a deactivated account being
            // signed into is worth its own record, distinct from a plain
            // guess, even though both surface as the same login_failed
            // filter entry.
            ActivityLog::create([
                'actor' => $user->email,
                'actor_name' => $user->name,
                'actor_role' => $user->role?->value,
                'ip_address' => $request->ip(),
                'action' => 'login_failed',
                'description' => 'Sign-in attempt on a deactivated account.',
            ]);

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            RateLimiter::hit($key, self::DECAY_SECONDS);
            RateLimiter::hit($ipKey, self::IP_DECAY_SECONDS);
            RateLimiter::hit($emailKey, self::EMAIL_DECAY_SECONDS);

            return response()->json([
                'message' => 'This account has been deactivated. Contact an administrator for access.',
            ], 403);
        }

        RateLimiter::clear($key);
        // Only this account's own counter — not the IP-wide one, which stays
        // live for every *other* email that IP might still be spraying.
        RateLimiter::clear($emailKey);
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
        // Logged ahead of the guard's own logout() — record() reads the
        // signed-in user off Auth::user(), which this call is about to clear.
        // Skipped for the "safe to call even without a live session" case:
        // nobody actually signed out, so there is nothing to audit.
        if (Auth::guard('web')->check()) {
            ActivityLog::record('logout', 'Signed out of the admin.');
        }

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

    private function ipThrottleKey(Request $request): string
    {
        return 'admin-login-ip|'.$request->ip();
    }

    private function emailThrottleKey(string $email): string
    {
        return 'admin-login-email|'.Str::lower($email);
    }
}
