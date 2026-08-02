<?php

namespace App\Http\Middleware;

use App\Services\RememberMeService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ends a signed-in admin session after config('icpep.idle_timeout_minutes')
 * (default 6 hours) with no genuine officer activity — distinct from Laravel's
 * own session lifetime (config/session.php), which any request bumps,
 * including the background polling several admin pages already do on their
 * own timers (AdminSidebar, Dashboard, AttendanceRoster) regardless of
 * whether anyone is actually at the keyboard.
 *
 * The 'last_meaningful_activity' timestamp this checks only moves forward
 * from AdminAuthController::login(), AuthenticateViaRememberToken (a cookie
 * revival is a genuine return), and MeController::activityPing() — which the
 * frontend calls only on real interaction while the tab is visible, throttled
 * (see components/admin/IdleLogout.tsx). Ordinary requests, polling included,
 * never touch it, so a background tab genuinely accrues idle time.
 *
 * Runs after 'auth.session' / EnsureAdmin in routes/admin.php, so it only
 * ever sees an already-authenticated request.
 */
class EnforceIdleTimeout
{
    public function handle(Request $request, Closure $next): Response
    {
        $timeoutSeconds = (int) config('icpep.idle_timeout_minutes') * 60;
        $last = $request->session()->get('last_meaningful_activity');

        if ($last !== null && now()->timestamp - (int) $last > $timeoutSeconds) {
            // Revoking the remember-me cookie too matters: without it, the
            // very next request would be silently logged back in by
            // AuthenticateViaRememberToken before this middleware ever ran,
            // making the forced logout invisible.
            RememberMeService::forgetCurrent($request);
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => 'Your session ended after being inactive for too long.',
                'reason' => 'inactivity_timeout',
            ], 401);
        }

        // First time this session is seen here (e.g. it predates this
        // feature) — start its clock now rather than treating a missing
        // value as already-expired.
        if ($last === null) {
            $request->session()->put('last_meaningful_activity', now()->timestamp);
        }

        return $next($request);
    }
}
