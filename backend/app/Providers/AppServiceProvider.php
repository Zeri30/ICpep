<?php

namespace App\Providers;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
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
        // Register every permission as a Gate ability, so routes, controllers and
        // the frontend all authorize against the same role→permission mapping.
        foreach (Permission::cases() as $permission) {
            Gate::define($permission->value, fn (User $user): bool => $user->hasPermission($permission));
        }

        // Log admin sign-ins to the activity history, and stamp the account's
        // last-login time (shown in User Management). saveQuietly so the stamp
        // doesn't itself count as an account edit.
        Event::listen(Login::class, function (Login $event): void {
            ActivityLog::create([
                'actor' => $event->user->email ?? null,
                'actor_role' => $event->user->role?->value,
                'ip_address' => request()?->ip(),
                'action' => 'login',
                'description' => 'Signed in to the admin',
            ]);

            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
        });
    }
}
