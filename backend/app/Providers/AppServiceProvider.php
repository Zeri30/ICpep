<?php

namespace App\Providers;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
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

        // Rate limits for the unauthenticated public API (routes/api.php) — it
        // has no session/account behind it to throttle by the way the admin
        // login does, so every limiter here keys on IP alone. Generous enough
        // that a real applicant filling out the form, or someone refreshing a
        // shared event link, never notices; tight enough that a script
        // hammering the endpoint does.
        //
        // Submitting the form is the one write in this group and the one
        // with a real cost (two file uploads, a database row) behind it, so
        // it gets the tightest limit.
        //
        // Deliberately just this one per-minute window, not a second,
        // longer-window cap (a per-day ceiling, say) layered on top the way
        // AdminAuthController layers its login limiters: this app's
        // applicants are students, routinely applying from a shared campus
        // or school-lab IP behind one NAT address, plausibly in a burst
        // during an orientation event. A tight daily cap would risk turning
        // real students away over a shared IP, which is a worse outcome
        // than the one this defends against — a script staying under 5/min
        // can still only manage a few hundred uploads an hour, bounded
        // enough already for what a school org's registration form needs
        // to withstand. Revisit only if sustained per-IP abuse is actually
        // observed, not preemptively.
        RateLimiter::for('applications', fn (Request $request): Limit => Limit::perMinute(5)->by($request->ip()));

        // registration-status and officers are cheap, page-load-driven reads.
        RateLimiter::for('public-reads', fn (Request $request): Limit => Limit::perMinute(60)->by($request->ip()));

        // A shared event link's token is already long and random — see
        // SharedEventController — so this is defence in depth against
        // guessing it, not the only thing standing in the way.
        RateLimiter::for('shared-event', fn (Request $request): Limit => Limit::perMinute(30)->by($request->ip()));

        // Log admin sign-ins to the activity history, and stamp the account's
        // last-login time (shown in User Management). saveQuietly so the stamp
        // doesn't itself count as an account edit.
        Event::listen(Login::class, function (Login $event): void {
            ActivityLog::create([
                'actor' => $event->user->email ?? null,
                'actor_name' => $event->user->name ?? null,
                'actor_role' => $event->user->role?->value,
                'ip_address' => request()?->ip(),
                'action' => 'login',
                'description' => 'Signed in to the admin',
            ]);

            $event->user->forceFill(['last_login_at' => now()])->saveQuietly();
        });
    }
}
