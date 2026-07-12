<?php

use App\Http\Controllers\ApplicationController;
use Illuminate\Support\Facades\Route;

// Public: submit a membership application (multipart form-data with files).
Route::post('/applications', [ApplicationController::class, 'store']);
