<?php

use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\OfficerController;
use App\Http\Controllers\SharedEventController;
use Illuminate\Support\Facades\Route;

// Public: whether the membership form is accepting submissions, and the reason
// if it isn't. The landing page asks before rendering the form.
Route::get('/registration-status', [ApplicationController::class, 'status']);

// Public: the executive board, read from the same accounts User Management
// edits — see OfficerController for which roles are shown.
Route::get('/officers', [OfficerController::class, 'index']);

// Public: submit a membership application (multipart form-data with files).
Route::post('/applications', [ApplicationController::class, 'store']);

// Public: an event shared by the Secretary — its details, attendance QR and
// code. The unguessable token in the URL is the only credential, and the
// controller re-checks that the event is still shareable on every request, so a
// link dies with the event rather than outliving it.
Route::get('/events/shared/{token}', [SharedEventController::class, 'show'])
    ->name('events.shared');
