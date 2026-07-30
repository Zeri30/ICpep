<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
