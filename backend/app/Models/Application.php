<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
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

    /**
     * How long a soft-deleted member stays visible under the "Deleted members"
     * filter. The row itself is never purged — this only bounds how long it
     * shows up in that filter (see MemberController::filtered).
     */
    public const DELETED_RETENTION_DAYS = 30;

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

            // Payment has its own dedicated ledger (Payment History /
            // payment_transactions) rather than being logged here too — see
            // recordPaymentTransaction(). Both payment columns can change in
            // the same save (e.g. the edit form marking both batches paid at
            // once), so each gets its own ledger row.
            $paymentColumns = array_intersect(['paid_at', 'payment2_paid_at'], array_keys($application->getChanges()));

            foreach ($paymentColumns as $column) {
                $application->recordPaymentTransaction($column);
            }

            if ($paymentColumns) {
                // A pure payment toggle shouldn't also log an edit — "pure"
                // meaning nothing changed but the payment column(s) themselves
                // plus the timestamp Eloquent always bumps.
                if (count($application->getChanges()) <= count($paymentColumns) + 1) {
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
        'membership_term_id',
        'surname',
        'given_name',
        'middle_initial',
        'student_id',
        'year_level',
        'section',
        'birthday',
        'address',
        'email',
        'phone',
        'signature_path',
        'picture_path',
        'paid_at',
        'payment2_paid_at',
    ];

    protected $casts = [
        'birthday' => 'date',
        'paid_at' => 'datetime',
        'payment2_paid_at' => 'datetime',
    ];

    /**
     * Payment 1 (₱50) paid. `paid_at` is both the flag and the date it
     * happened — kept under its original column name even though the fee is
     * now split into two batches, to avoid renaming it everywhere; it
     * specifically means "Payment 1" from here on. See getIsPayment2PaidAttribute
     * for the second batch (₱25), which can only be paid once this one is.
     */
    public function getIsPaidAttribute(): bool
    {
        return $this->paid_at !== null;
    }

    /** Payment 2 (₱25) paid. Same is-null-or-not design as Payment 1. */
    public function getIsPayment2PaidAttribute(): bool
    {
        return $this->payment2_paid_at !== null;
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /** The semester's membership list this member was registered under. */
    public function membershipTerm(): BelongsTo
    {
        return $this->belongsTo(MembershipTerm::class);
    }

    /**
     * Narrow to one semester's membership list. Every admin list is scoped this
     * way, so a past term reads as the closed record it is.
     *
     * @param  Builder<Application>  $query
     */
    public function scopeForTerm(Builder $query, int $termId): Builder
    {
        return $query->where('membership_term_id', $termId);
    }

    /**
     * Append a ledger row describing what just happened to one payment column
     * (`paid_at` = Payment 1, `payment2_paid_at` = Payment 2).
     *
     * Called from the `updated` event so it captures every route to a payment
     * change — the row action, the bulk action and a manual form edit alike —
     * rather than each of those having to remember to log.
     *
     * Member name and section are denormalised onto the row so the history stays
     * readable after a rename, and survives a force-delete of the member.
     */
    public function recordPaymentTransaction(string $column): void
    {
        $kind = $column === 'payment2_paid_at' ? PaymentTransaction::PAYMENT_2 : PaymentTransaction::PAYMENT_1;
        $fee = (float) config($kind === PaymentTransaction::PAYMENT_2 ? 'icpep.membership_fee_2' : 'icpep.membership_fee_1');
        $previous = $this->getOriginal($column);
        $previous = $previous ? Carbon::parse($previous) : null;
        $current = $this->{$column};

        [$action, $amount, $effectiveAt] = match (true) {
            // Unpaid -> paid.
            $previous === null && $current !== null => [
                PaymentTransaction::PAID, $fee, $current,
            ],
            // Paid -> unpaid. The reversal is stamped against the date the money
            // was originally taken, so it lands in the same period it cancels.
            $previous !== null && $current === null => [
                PaymentTransaction::REVOKED, -$fee, $previous,
            ],
            // Payment date corrected. The before/after dates are the row's own
            // previous_effective_at and effective_at — the reader has both, so
            // there is nothing left to say in prose.
            default => [
                PaymentTransaction::ADJUSTED, 0.0, $current,
            ],
        };

        $this->paymentTransactions()->create([
            // The member's own term, not the current one: correcting a past
            // semester's payment must stay in that semester's figures.
            'membership_term_id' => $this->membership_term_id,
            'action' => $action,
            'kind' => $kind,
            'amount' => $amount,
            'effective_at' => $effectiveAt,
            'previous_effective_at' => $previous,
            'actor' => Auth::user()?->email,
            'member_name' => $this->full_name,
            'section' => $this->section,
            'year_level' => $this->year_level,
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

    /**
     * Narrow to a single year level, independent of section. An unknown value
     * is a no-op, same as scopeInClass, so a bad filter never silently empties
     * the list.
     *
     * @param  Builder<Application>  $query
     */
    public function scopeYearLevel(Builder $query, string $year): Builder
    {
        if (! in_array($year, self::YEAR_LEVELS, true)) {
            return $query;
        }

        return $query->where('year_level', $year);
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
