<?php

namespace App\Providers;

use App\Models\ActivityLog;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
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
