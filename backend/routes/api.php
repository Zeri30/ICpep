<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\OfficerController;
use App\Http\Controllers\SchedulerController;
use App\Http\Controllers\SharedEventController;
use App\Http\Controllers\UpcomingEventsController;
use Illuminate\Support\Facades\Route;

// Public and unauthenticated, so each is throttled by IP alone — see the
// named limiters in AppServiceProvider::boot() for why each gets the limit
// it does.

// Whether the membership form is accepting submissions, and the reason if it
// isn't. The landing page asks before rendering the form.
Route::get('/registration-status', [ApplicationController::class, 'status'])
    ->middleware('throttle:public-reads');

// The executive board, read from the same accounts User Management edits —
// see OfficerController for which roles are shown.
Route::get('/officers', [OfficerController::class, 'index'])
    ->middleware('throttle:public-reads');

// The landing page's Upcoming Events section — every Scheduled event dated
// today or later, straight from the Secretary's calendar. See
// UpcomingEventsController for why cancelled, done, and past events never
// reach it.
Route::get('/events/upcoming', [UpcomingEventsController::class, 'index'])
    ->middleware('throttle:public-reads');

// Submit a membership application (multipart form-data with files).
Route::post('/applications', [ApplicationController::class, 'store'])
    ->middleware('throttle:applications');

// An event shared by the Secretary — its details, attendance QR and code. The
// unguessable token in the URL is the only credential, and the controller
// re-checks that the event is still shareable on every request, so a link
// dies with the event rather than outliving it.
Route::get('/events/shared/{token}', [SharedEventController::class, 'show'])
    ->name('events.shared')
    ->middleware('throttle:shared-event');

// The external cron ping standing in for a real crontab — see
// SchedulerController. POST because it has side effects (deleting rows),
// even though the only "session" behind it is a shared-secret query token.
Route::post('/scheduler/run', [SchedulerController::class, 'run'])
    ->middleware('throttle:scheduler');
