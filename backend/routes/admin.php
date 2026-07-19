<?php

use App\Http\Controllers\Api\Admin\ActivityController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\MeController;
use App\Http\Controllers\Api\Admin\MemberController;
use App\Http\Controllers\Api\Admin\MembershipTermController;
use App\Http\Controllers\Api\Admin\PaymentController;
use App\Http\Controllers\Api\Admin\RegistrationController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

/*
| JSON admin API for the React admin. Mounted at /api/admin under the `web`
| middleware group (in bootstrap/app.php), so it shares the session and CSRF
| protection the officer login already establishes. Every route requires a
| signed-in, active officer via EnsureAdmin; individual modules and write
| actions are then gated by role via the `permission:*` middleware (backed by
| the Gates in AppServiceProvider). Finer-grained checks (e.g. the mixed bulk
| endpoint) authorize inside the controller.
|
| Sign-in/out live under /auth (AdminAuthController) alongside the existing
| login, since the frontend already proxies /auth and talks to it.
*/

Route::middleware(EnsureAdmin::class)->group(function () {
    // Open to any active administrator.
    Route::get('/me', [MeController::class, 'show'])->name('me');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/counts', [DashboardController::class, 'counts'])->name('counts');
    Route::get('/activity', [ActivityController::class, 'index'])->name('activity.index');

    // Membership lists and the public form's open/closed state. Reading both is
    // open to any officer — the Members module shows the list selector and a
    // registration banner to everyone. Changing either is the semester rollover
    // and needs terms.manage, authorized in the controllers.
    Route::get('/terms', [MembershipTermController::class, 'index'])->name('terms.index');
    Route::post('/terms', [MembershipTermController::class, 'store'])->name('terms.store');
    Route::post('/terms/{term}/activate', [MembershipTermController::class, 'activate'])->name('terms.activate');
    Route::get('/registration', [RegistrationController::class, 'show'])->name('registration.show');
    Route::post('/registration/close', [RegistrationController::class, 'close'])->name('registration.close');
    Route::post('/registration/open', [RegistrationController::class, 'open'])->name('registration.open');

    // Members — reading needs members.view; the writes below gate more tightly.
    Route::middleware('permission:members.view')->group(function () {
        Route::get('/members', [MemberController::class, 'index'])->name('members.index');
        Route::get('/members/{application}', [MemberController::class, 'show'])->withTrashed()->name('members.show');
        Route::get('/members/{application}/download/{which}', [MemberController::class, 'download'])->withTrashed()->name('members.download');
    });

    // Member writes: editing member data vs. changing payment status are
    // distinct permissions, so they are authorized inside the controller (the
    // bulk endpoint mixes both). members.view still gates reaching them at all.
    Route::middleware('permission:members.view')->group(function () {
        Route::post('/members/bulk', [MemberController::class, 'bulk'])->name('members.bulk');
        Route::patch('/members/{application}', [MemberController::class, 'update'])->name('members.update');
        Route::delete('/members/{application}', [MemberController::class, 'destroy'])->name('members.destroy');
        Route::post('/members/{application}/toggle-paid', [MemberController::class, 'togglePaid'])->name('members.togglePaid');
        Route::post('/members/{application}/restore', [MemberController::class, 'restore'])->withTrashed()->name('members.restore');
    });

    // Financial modules — Treasurer roles only.
    Route::middleware('permission:finance.view')->group(function () {
        Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
    });

    // User Management — administrator accounts. Programming Team only.
    Route::middleware('permission:users.manage')->group(function () {
        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        Route::get('/users/{user}', [UserController::class, 'show'])->name('users.show');
        Route::patch('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::post('/users/{user}/toggle-active', [UserController::class, 'toggleActive'])->name('users.toggleActive');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.resetPassword');
    });
});
