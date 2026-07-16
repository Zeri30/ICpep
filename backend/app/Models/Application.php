<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;

class Application extends Model
{
    use SoftDeletes;

    /** Year levels / sections offered on the public membership form. */
    public const YEAR_LEVELS = ['3rd Year', '4th Year'];

    public const SECTIONS = ['Section A', 'Section B'];

    /** Combined "Year & Section" codes (e.g. 3A) → [year_level, section]. */
    public const CLASS_MAP = [
        '3A' => ['3rd Year', 'Section A'],
        '3B' => ['3rd Year', 'Section B'],
        '4A' => ['4th Year', 'Section A'],
        '4B' => ['4th Year', 'Section B'],
    ];

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

            // Payment is its own event — logging it as a generic "edited details"
            // would bury the thing an officer most needs to audit.
            if ($application->wasChanged('paid_at')) {
                $application->recordPaymentTransaction();

                $application->paid_at
                    ? ActivityLog::record('paid', "Marked {$application->full_name} as paid", $application->full_name)
                    : ActivityLog::record('unpaid', "Marked {$application->full_name} as unpaid", $application->full_name);

                // A pure payment toggle shouldn't also log an edit.
                if (count($application->getChanges()) <= 2) { // paid_at + updated_at
                    return;
                }
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
        'paid_at',
    ];

    protected $casts = [
        'birthday' => 'date',
        'paid_at' => 'datetime',
    ];

    /** Membership fee paid. `paid_at` is both the flag and the date it happened. */
    public function getIsPaidAttribute(): bool
    {
        return $this->paid_at !== null;
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /**
     * Append a ledger row describing what just happened to `paid_at`.
     *
     * Called from the `updated` event so it captures every route to a payment
     * change — the row action, the bulk action and a manual form edit alike —
     * rather than each of those having to remember to log.
     *
     * Member name and section are denormalised onto the row so the history stays
     * readable after a rename, and survives a force-delete of the member.
     */
    public function recordPaymentTransaction(): void
    {
        $fee = (float) config('icpep.membership_fee');
        $previous = $this->getOriginal('paid_at');
        $previous = $previous ? Carbon::parse($previous) : null;
        $current = $this->paid_at;

        [$action, $amount, $effectiveAt, $note] = match (true) {
            // Unpaid -> paid.
            $previous === null && $current !== null => [
                PaymentTransaction::PAID, $fee, $current, null,
            ],
            // Paid -> unpaid. The reversal is stamped against the date the money
            // was originally taken, so it lands in the same period it cancels.
            $previous !== null && $current === null => [
                PaymentTransaction::REVOKED, -$fee, $previous, null,
            ],
            // Payment date corrected.
            default => [
                PaymentTransaction::ADJUSTED, 0.0, $current, sprintf(
                    'Payment date changed from %s to %s',
                    $previous?->format('M j, Y g:i A') ?? '—',
                    $current?->format('M j, Y g:i A') ?? '—',
                ),
            ],
        };

        $this->paymentTransactions()->create([
            'action' => $action,
            'amount' => $amount,
            'effective_at' => $effectiveAt,
            'previous_effective_at' => $previous,
            'actor' => Auth::user()?->email,
            'member_name' => $this->full_name,
            'section' => $this->section,
            'note' => $note,
        ]);
    }

    /**
     * Narrow to a combined year+section code (e.g. "3A"). An unknown code is a
     * no-op, so a bad filter value never silently empties the list.
     *
     * @param  Builder<Application>  $query
     */
    public function scopeInClass(Builder $query, string $code): Builder
    {
        if (! isset(self::CLASS_MAP[$code])) {
            return $query;
        }

        [$year, $section] = self::CLASS_MAP[$code];

        return $query->where('year_level', $year)->where('section', $section);
    }

    /** @param  Builder<Application>  $query */
    public function scopePaid(Builder $query): Builder
    {
        return $query->whereNotNull('paid_at');
    }

    /** @param  Builder<Application>  $query */
    public function scopeUnpaid(Builder $query): Builder
    {
        return $query->whereNull('paid_at');
    }

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
