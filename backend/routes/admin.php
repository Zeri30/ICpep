<?php

use App\Http\Controllers\Api\Admin\ActivityController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\MeController;
use App\Http\Controllers\Api\Admin\MemberController;
use App\Http\Controllers\Api\Admin\PaymentController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

/*
| JSON admin API for the React admin. Mounted at /api/admin under the `web`
| middleware group (in bootstrap/app.php), so it shares the session and CSRF
| protection the officer login already establishes. Every route requires a
| signed-in officer via EnsureAdmin.
|
| Sign-in/out live under /auth (AdminAuthController) alongside the existing
| login, since the frontend already proxies /auth and talks to it.
*/

Route::middleware(EnsureAdmin::class)->group(function () {
    Route::get('/me', [MeController::class, 'show'])->name('me');

    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/members', [MemberController::class, 'index'])->name('members.index');
    Route::get('/members/{application}', [MemberController::class, 'show'])->name('members.show');

    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');

    Route::get('/activity', [ActivityController::class, 'index'])->name('activity.index');
});
