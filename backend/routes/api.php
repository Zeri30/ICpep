<?php

use App\Http\Controllers\ApplicationController;
use Illuminate\Support\Facades\Route;

// Public: whether the membership form is accepting submissions, and the reason
// if it isn't. The landing page asks before rendering the form.
Route::get('/registration-status', [ApplicationController::class, 'status']);

// Public: submit a membership application (multipart form-data with files).
Route::post('/applications', [ApplicationController::class, 'store']);
