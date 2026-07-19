<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Singleton holding whether the public membership form accepts submissions.
 *
 * Open/closed is deliberately global rather than a property of a term: the
 * destination of a submission (the current {@see MembershipTerm}) and whether
 * submissions are accepted at all are separate decisions. That is what lets an
 * officer close registration, roll the term over, and reopen — with the new
 * applicants landing in the new list purely because it is the current one.
 */
class RegistrationSetting extends Model
{
    /** Reasons offered in the close dialog. A custom reason is also allowed. */
    public const PRESET_REASONS = [
        'Technical Issue',
        'End of School Year',
        'Semestral Break',
    ];

    protected $fillable = [
        'is_open',
        'closed_reason',
        'closed_at',
        'closed_by',
        'opened_at',
        'opened_by',
    ];

    protected $casts = [
        'is_open' => 'boolean',
        'closed_at' => 'datetime',
        'opened_at' => 'datetime',
    ];

    /**
     * The one settings row, created open on first access so a fresh database
     * (or a test that never ran the backfill) behaves like the old always-open
     * form rather than locking applicants out.
     */
    public static function instance(): self
    {
        return static::firstOrCreate([], ['is_open' => true]);
    }

    public function close(string $reason): void
    {
        $this->update([
            'is_open' => false,
            'closed_reason' => $reason,
            'closed_at' => now(),
            'closed_by' => Auth::user()?->email,
        ]);

        ActivityLog::record('registration_closed', "Closed membership registration — {$reason}");
    }

    public function open(): void
    {
        $term = MembershipTerm::current();
        $destination = $term ? " — new applicants go to {$term->label}" : '';

        $this->update([
            'is_open' => true,
            'closed_reason' => null,
            'opened_at' => now(),
            'opened_by' => Auth::user()?->email,
        ]);

        ActivityLog::record('registration_opened', "Reopened membership registration{$destination}");
    }
}
