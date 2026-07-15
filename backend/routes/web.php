<?php

use App\Http\Controllers\AdminAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Sign-in modal on the landing page. These sit on the "web" middleware group so
// they share the session and CSRF protection Filament's own login relies on,
// and the frontend reaches them through the /auth rewrites in next.config.ts.
Route::get('/auth/csrf', [AdminAuthController::class, 'csrf']);
Route::post('/auth/admin/login', [AdminAuthController::class, 'login']);
