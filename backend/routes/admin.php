<?php

use App\Http\Controllers\Api\Admin\ActivityController;
use App\Http\Controllers\Api\Admin\AttendanceController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\EventController;
use App\Http\Controllers\Api\Admin\MeController;
use App\Http\Controllers\Api\Admin\MemberController;
use App\Http\Controllers\Api\Admin\MembershipTermController;
use App\Http\Controllers\Api\Admin\PaymentController;
use App\Http\Controllers\Api\Admin\RegistrationController;
use App\Http\Controllers\Api\Admin\RolePermissionController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Middleware\EnforceIdleTimeout;
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

// 'auth.session' runs ahead of EnsureAdmin so a session whose password hash
// has gone stale (the account was reset or changed its password elsewhere) is
// rejected before anything else here even asks who it belongs to — see the
// alias's own note in bootstrap/app.php for what it does and why.
Route::middleware(['auth.session', EnsureAdmin::class, EnforceIdleTimeout::class])->group(function () {
    // Open to any active administrator.
    Route::get('/me', [MeController::class, 'show'])->name('me');
    // Polled by SessionWatchdog.tsx to notice a remotely-ended session fast —
    // see MeController::ping.
    Route::get('/me/ping', [MeController::class, 'ping'])->name('me.ping');
    // The one write EnsureAdmin still lets a must-change-password account
    // reach — see the middleware for why everything else is closed to it.
    Route::post('/me/password', [MeController::class, 'updatePassword'])->name('me.password.update');
    // "Manage sessions" in the account menu — see MeController for the
    // difference between the two.
    Route::post('/me/sessions/logout-others', [MeController::class, 'logoutOtherSessions'])->name('me.sessions.logout-others');
    Route::post('/me/sessions/logout-all', [MeController::class, 'logoutAllSessions'])->name('me.sessions.logout-all');
    // The 6-hour inactivity timeout's heartbeat — see EnforceIdleTimeout and
    // components/admin/IdleLogout.tsx. Deliberately not itself exempt from
    // EnforceIdleTimeout: an officer's first action after 6+ idle hours
    // should end the session, not extend it.
    Route::post('/me/activity-ping', [MeController::class, 'activityPing'])->name('me.activity-ping');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/counts', [DashboardController::class, 'counts'])->name('counts');
    Route::get('/activity', [ActivityController::class, 'index'])->name('activity.index');
    Route::post('/me/views/activity', [MeController::class, 'viewedActivity'])->name('me.views.activity');

    // Payment History — the read-only ledger. Gated on finance.view so the
    // module can be turned on or off per role from the Privileges panel; the
    // same permission hides the revenue figures on the dashboard, so "access
    // financial modules" means one consistent thing wherever it is granted.
    // Acting on payments is a separate ability and still needs members.payment.
    Route::middleware('permission:finance.view')->group(function () {
        Route::get('/payments', [PaymentController::class, 'index'])->name('payments.index');
        // Polled by PaymentHistory.tsx for real-time sync — see PaymentController::changes.
        Route::get('/payments/changes', [PaymentController::class, 'changes'])->name('payments.changes');
        Route::get('/payments/export/csv', [PaymentController::class, 'exportCsv'])->name('payments.export.csv');
        Route::get('/payments/export/excel', [PaymentController::class, 'exportExcel'])->name('payments.export.excel');
        Route::get('/payments/export/pdf', [PaymentController::class, 'exportPdf'])->name('payments.export.pdf');
        Route::post('/me/views/payments', [MeController::class, 'viewedPayments'])->name('me.views.payments');
    });

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

    // The calendar. Reading is open to every officer — a schedule only some of
    // them can see is not a schedule. Changing it needs schedule.manage, held
    // by the Secretary alone by default, so every other role's calendar is
    // view-only whether or not the UI offers them a button.
    Route::get('/events', [EventController::class, 'index'])->name('events.index');
    Route::middleware('permission:schedule.manage')->group(function () {
        Route::post('/events', [EventController::class, 'store'])->name('events.store');
        Route::patch('/events/{event}', [EventController::class, 'update'])->name('events.update');
        Route::patch('/events/{event}/status', [EventController::class, 'status'])->name('events.status');
        Route::post('/events/{event}/share', [EventController::class, 'share'])->name('events.share');
        Route::delete('/events/{event}', [EventController::class, 'destroy'])->name('events.destroy');
    });

    // Attendance. Checking yourself in is open to every active officer — that is
    // the whole design, since the QR identifies the event and the session
    // identifies the person, so anyone holding a phone in the room can do it
    // without the Secretary touching anything.
    //
    // The roster is the other half and is the secretariat's: it says who missed
    // which meeting, and it is gated on the same schedule.manage that already
    // withholds the QR token it is built from from every other role. Authorized
    // in the controller rather than by middleware here, so the two check-in
    // routes and the two roster routes can sit together and be read as one
    // module.
    Route::get('/check-in', [AttendanceController::class, 'show'])->name('attendance.show');
    Route::post('/check-in', [AttendanceController::class, 'store'])->name('attendance.store');
    Route::get('/events/{event}/attendance', [AttendanceController::class, 'index'])->name('attendance.index');
    Route::patch('/events/{event}/attendance/{user}', [AttendanceController::class, 'update'])->name('attendance.update');

    // Members — reading needs members.view; the writes below gate more tightly.
    Route::middleware('permission:members.view')->group(function () {
        Route::get('/members', [MemberController::class, 'index'])->name('members.index');
        Route::post('/me/views/members', [MeController::class, 'viewedMembers'])->name('me.views.members');
        // Polled by MembersList.tsx for real-time payment sync — see
        // MemberController::changes. Declared before /members/{application} for
        // the same reason /members/export/* is.
        Route::get('/members/changes', [MemberController::class, 'changes'])->name('members.changes');
        Route::get('/members/export/csv', [MemberController::class, 'exportCsv'])->name('members.export.csv');
        Route::get('/members/export/excel', [MemberController::class, 'exportExcel'])->name('members.export.excel');
        Route::get('/members/export/pdf', [MemberController::class, 'exportPdf'])->name('members.export.pdf');
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
        Route::post('/members/{application}/toggle-paid', [MemberController::class, 'togglePayment'])->name('members.togglePaid');
        Route::post('/members/{application}/restore', [MemberController::class, 'restore'])->withTrashed()->name('members.restore');
    });

    // User Management — administrator accounts. Programming Team only.
    Route::middleware('permission:users.manage')->group(function () {
        // Privileges — the editable role→permission matrix. Declared before the
        // /users/{user} routes so "roles" is never taken for an account id.
        Route::get('/users/roles', [RolePermissionController::class, 'index'])->name('roles.index');
        Route::put('/users/roles/{role}', [RolePermissionController::class, 'update'])->name('roles.update');
        Route::post('/users/roles/{role}/reset', [RolePermissionController::class, 'reset'])->name('roles.reset');

        Route::get('/users', [UserController::class, 'index'])->name('users.index');
        Route::post('/me/views/users', [MeController::class, 'viewedUsers'])->name('me.views.users');
        Route::post('/users', [UserController::class, 'store'])->name('users.store');
        // Declared before /users/{user} for the same reason /users/roles is —
        // otherwise "logout-all-sessions" would be taken for an account id.
        Route::post('/users/logout-all-sessions', [UserController::class, 'logoutAllAdminSessions'])->name('users.logoutAllSessions');
        Route::get('/users/{user}', [UserController::class, 'show'])->name('users.show');
        Route::patch('/users/{user}', [UserController::class, 'update'])->name('users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('users.destroy');
        Route::post('/users/{user}/toggle-active', [UserController::class, 'toggleActive'])->name('users.toggleActive');
        Route::post('/users/{user}/reset-password', [UserController::class, 'resetPassword'])->name('users.resetPassword');
    });
});
