<?php

namespace App\Http\Controllers;

use Filament\Facades\Filament;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        if (! Auth::guard('web')->attempt($credentials, $request->boolean('remember'))) {
            RateLimiter::hit($key, self::DECAY_SECONDS);

            return response()->json(['message' => 'Those credentials do not match our records.'], 422);
        }

        // Mirror the panel's own gate: a valid password is not enough if the
        // account is not permitted into the admin. Without this we would leave
        // behind a signed-in session for someone Filament would turn away.
        if (! Auth::user()->canAccessPanel(Filament::getPanel('admin'))) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            RateLimiter::hit($key, self::DECAY_SECONDS);

            return response()->json(['message' => 'This account cannot access the admin.'], 403);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return response()->json(['redirect' => Filament::getPanel('admin')->getUrl()]);
    }

    private function throttleKey(Request $request, string $email): string
    {
        return 'admin-login|'.Str::lower($email).'|'.$request->ip();
    }
}
