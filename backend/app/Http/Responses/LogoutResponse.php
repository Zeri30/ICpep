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
        // APP_URL is the origin the site is actually browsed on (the Next
        // frontend, which proxies /admin through), so this lands on the
        // landing page in both dev and production.
        return redirect()->to(config('app.url'));
    }
}
