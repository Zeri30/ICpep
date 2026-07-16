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
    Route::post('/members/bulk', [MemberController::class, 'bulk'])->name('members.bulk');
    Route::post('/members/mark-all-paid', [MemberController::class, 'markAllPaid'])->name('members.markAllPaid');
    Route::get('/members/{application}', [MemberController::class, 'show'])->withTrashed()->name('members.show');
    Route::patch('/members/{application}', [MemberController::class, 'update'])->name('members.update');
    Route::delete('/members/{application}', [MemberController::class, 'destroy'])->name('members.destroy');
    Route::post('/members/{application}/toggle-paid', [MemberController::class, 'togglePaid'])->name('members.togglePaid');
    Route::post('/members/{application}/restore', [MemberController::class, 'restore'])->withTrashed()->name('members.restore');
    Route::get('/members/{application}/download/{which}', [MemberController::class, 'download'])->withTrashed()->name('members.download');

    Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');

    Route::get('/activity', [ActivityController::class, 'index'])->name('activity.index');
});
