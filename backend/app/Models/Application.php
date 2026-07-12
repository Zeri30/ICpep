<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Application extends Model
{
    use SoftDeletes;

    /** Log activity on key lifecycle events, and clean up files on permanent delete. */
    protected static function booted(): void
    {
        static::created(function (Application $application): void {
            ActivityLog::record('registered', "New application from {$application->full_name}", $application->full_name);
        });

        static::updated(function (Application $application): void {
            if ($application->wasChanged('status')) {
                $action = $application->status; // approved | rejected | pending
                ActivityLog::record($action, ucfirst($action)." {$application->full_name}'s application", $application->full_name);
            }
        });

        // Soft delete → kept in the "Deleted" tab; files are retained for review.
        static::deleted(function (Application $application): void {
            if (! $application->isForceDeleting()) {
                ActivityLog::record('deleted', "Moved {$application->full_name}'s application to Deleted", $application->full_name);
            }
        });

        static::restored(function (Application $application): void {
            ActivityLog::record('restored', "Restored {$application->full_name}'s application", $application->full_name);
        });

        // Permanent delete → remove the uploaded files from storage.
        static::forceDeleted(function (Application $application): void {
            ActivityLog::record('force_deleted', "Permanently deleted {$application->full_name}'s application", $application->full_name);
            try {
                Storage::disk('supabase')->delete(array_filter([
                    $application->signature_path,
                    $application->picture_path,
                ]));
            } catch (\Throwable $e) {
                // Ignore storage errors so the record can still be removed.
            }
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
        'status',
    ];

    protected $casts = [
        'birthday' => 'date',
    ];

    /** Convenience: "Surname, Given Name M." */
    public function getFullNameAttribute(): string
    {
        $mi = $this->middle_initial ? " {$this->middle_initial}." : '';

        return "{$this->surname}, {$this->given_name}{$mi}";
    }
}
