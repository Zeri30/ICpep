<?php

namespace App\Http\Responses;

use Filament\Http\Responses\Auth\Contracts\LogoutResponse as Responsable;
use Illuminate\Http\RedirectResponse;

/**
 * Sends officers back to the public landing page after signing out, instead of
 * Filament's default of bouncing them to /admin/login — which looks like a
 * failed sign-in rather than a completed sign-out.
 *
 * Replacing only the response leaves Filament's LogoutController to do the
 * actual work (logout, session invalidate, CSRF token regenerate), so this
 * changes the destination and nothing about the security behaviour.
 *
 * Bound to the contract in AppServiceProvider.
 */
class LogoutResponse implements Responsable
{
    public function toResponse($request): RedirectResponse
    {
        // The public landing page lives on the Next frontend, a separate origin
        // from the admin — so send officers there, not to APP_URL (the Laravel
        // backend, whose "/" is just the framework welcome page).
        return redirect()->to(config('app.frontend_url'));
    }
}
