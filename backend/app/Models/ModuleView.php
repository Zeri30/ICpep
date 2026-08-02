<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One officer's "last opened this module" marker — see the migration for why
 * this exists. `module` is one of the sidebar's badgeKey values: 'members',
 * 'payments', 'users'.
 */
class ModuleView extends Model
{
    protected $table = 'admin_module_views';

    protected $fillable = [
        'user_id',
        'module',
        'last_viewed_at',
    ];

    protected function casts(): array
    {
        return [
            'last_viewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Record that $user just opened $module, resetting its unread count to zero. */
    public static function markViewed(User $user, string $module): void
    {
        self::updateOrCreate(
            ['user_id' => $user->id, 'module' => $module],
            ['last_viewed_at' => now()],
        );
    }

    /**
     * Every module this user has viewed, keyed by module name — one query for
     * all three of DashboardController::counts' badges instead of three.
     *
     * @return \Illuminate\Support\Collection<string, \Illuminate\Support\Carbon>
     */
    public static function lastViewedFor(User $user): \Illuminate\Support\Collection
    {
        return self::where('user_id', $user->id)->pluck('last_viewed_at', 'module');
    }
}
