<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Application extends Model
{
    use SoftDeletes;

    /** Log activity on key lifecycle events, and clean up files on permanent delete. */
    protected static function booted(): void
    {
        static::created(function (Application $application): void {
            ActivityLog::record('registered', "New member registered: {$application->full_name}", $application->full_name);
        });

        // Admin edits to a member's details.
        static::updated(function (Application $application): void {
            // A restore() also triggers `updated` (it clears deleted_at); that is
            // logged separately by the `restored` event, so skip it here.
            if ($application->wasChanged('deleted_at')) {
                return;
            }

            ActivityLog::record('updated', "Edited {$application->full_name}'s details", $application->full_name);
        });

        // Soft delete → kept in the "Deleted" tab; files are retained for review.
        static::deleted(function (Application $application): void {
            if (! $application->isForceDeleting()) {
                ActivityLog::record('deleted', "Moved {$application->full_name} to Deleted", $application->full_name);
            }
        });

        static::restored(function (Application $application): void {
            ActivityLog::record('restored', "Restored {$application->full_name}", $application->full_name);
        });
    }

    protected $fillable = [
        'surname',
        'given_name',
        'middle_initial',
        'year_level',
        'section',
        'birthday',
        'address',
        'email',
        'phone',
        'signature_path',
        'picture_path',
    ];

    protected $casts = [
        'birthday' => 'date',
    ];

    /** Convenience: "Last Name, First Name, Middle Initial" e.g. "Dela Cruz, Juan, S." */
    public function getFullNameAttribute(): string
    {
        $mi = $this->middle_initial ? ", {$this->middle_initial}." : '';

        return "{$this->surname}, {$this->given_name}{$mi}";
    }

    /**
     * Compact year+section code used for filtering/display, e.g. "3rd Year" +
     * "Section A" → "3A". Falls back gracefully for unexpected values.
     */
    public function getClassCodeAttribute(): string
    {
        $year = preg_replace('/\D/', '', (string) $this->year_level);          // "3rd Year" → "3"
        $section = strtoupper(trim(str_ireplace('Section', '', (string) $this->section))); // "Section A" → "A"

        return $year.$section;
    }
}
