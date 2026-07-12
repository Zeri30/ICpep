<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    protected $fillable = ['actor', 'action', 'description', 'applicant'];

    /** Record an activity entry, tagging the current admin (or the website). */
    public static function record(string $action, string $description, ?string $applicant = null): void
    {
        static::create([
            'actor' => Auth::user()?->email ?? 'Website',
            'action' => $action,
            'description' => $description,
            'applicant' => $applicant,
        ]);
    }
}
