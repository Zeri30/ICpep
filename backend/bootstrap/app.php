<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // The admin API is stateful (session + CSRF), so it rides the `web`
        // group rather than the stateless `api` one. Mounted at /api/admin.
        then: function (): void {
            Route::middleware('web')
                ->prefix('api/admin')
                ->name('admin.api.')
                ->group(base_path('routes/admin.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Appended (not aliased) so it runs on every stateful request without
        // routes/admin.php having to opt in — a "remember me" cookie needs to
        // revive a guest before 'auth.session'/EnsureAdmin ever get to ask who
        // they are. See the middleware's own docblock for the ordering.
        $middleware->web(append: [
            \App\Http\Middleware\AuthenticateViaRememberToken::class,
        ]);

        // Route-level permission gate for the admin API, e.g.
        // ->middleware('permission:members.edit'). See App\Enums\Permission.
        //
        // 'auth.session' is Laravel's own stale-session guard: it stores a
        // hash of the signed-in officer's password in their session and
        // compares it against the account's current one on every request,
        // logging out any session whose hash no longer matches. Aliased here
        // so routes/admin.php can put it in front of EnsureAdmin — the effect
        // is that resetting an account's password (UserController::resetPassword)
        // or changing it (MeController::updatePassword) signs that account out
        // everywhere else it was signed in, without this app having to track
        // sessions per account itself.
        $middleware->alias([
            'permission' => \App\Http\Middleware\EnsurePermission::class,
            'auth.session' => \Illuminate\Session\Middleware\AuthenticateSession::class,
        ]);

        // Off by default — every request's peer address is trusted as-is,
        // correct for a deployment PHP answers directly. Deployed behind a
        // reverse proxy or load balancer (nearly every PaaS) without this,
        // every request looks like it came from the proxy: the per-IP login
        // and public-API rate limiters (AdminAuthController, AppServiceProvider)
        // would then throttle the whole site as one visitor, and
        // config('session.secure')'s own auto-detection (config/session.php)
        // would never see the request as HTTPS even when it is. Set
        // TRUSTED_PROXIES to the proxy's IP(s), or "*" when the platform's
        // own network is the only way to reach this app, to have Laravel read
        // the real client from X-Forwarded-*.
        $trustedProxies = trim((string) env('TRUSTED_PROXIES', ''));
        $middleware->trustProxies(
            at: match (true) {
                $trustedProxies === '' => null,
                $trustedProxies === '*' => '*',
                default => array_filter(array_map('trim', explode(',', $trustedProxies))),
            },
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
