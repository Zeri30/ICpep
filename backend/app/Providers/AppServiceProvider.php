<?php

namespace App\Providers;

use App\Models\ActivityLog;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // The admin is reached through the frontend's /admin proxy, so URLs must
        // be generated on that origin (APP_URL). Without this, Filament emits
        // asset and Livewire URLs pointing straight at this server, and the
        // browser would leave the proxy the moment the panel loads.
        //
        // This runs in register(), not boot(): Filament's PanelProvider builds
        // the panel — resolving its brand logo and favicon through asset() — in
        // its own register(), which would otherwise happen first.
        URL::forceRootUrl(config('app.url'));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Log admin sign-ins to the activity history.
        Event::listen(Login::class, function (Login $event): void {
            ActivityLog::create([
                'actor' => $event->user->email ?? null,
                'action' => 'login',
                'description' => 'Signed in to the admin',
            ]);
        });
    }
}
