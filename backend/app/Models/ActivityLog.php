<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    protected $fillable = ['actor', 'actor_role', 'ip_address', 'action', 'description', 'applicant'];

    /**
     * Record an activity entry, tagging the current admin (email + role) and the
     * originating IP so every change is traceable to who did it and from where.
     */
    public static function record(string $action, string $description, ?string $applicant = null): void
    {
        $user = Auth::user();

        static::create([
            'actor' => $user?->email ?? 'Website',
            'actor_role' => $user?->role?->value,
            'ip_address' => request()?->ip(),
            'action' => $action,
            'description' => $description,
            'applicant' => $applicant,
        ]);
    }
}
