<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/**
 * One membership-fee event. Written by Application's model events, never by
 * hand — see App\Models\Application::booted().
 */
class PaymentTransaction extends Model
{
    public const PAID = 'paid';

    public const REVOKED = 'revoked';

    public const ADJUSTED = 'adjusted';

    /** Which of the two sequential payment batches this row describes. */
    public const PAYMENT_1 = 'payment1';

    public const PAYMENT_2 = 'payment2';

    protected $fillable = [
        'application_id',
        'membership_term_id',
        'action',
        'kind',
        'amount',
        'effective_at',
        'previous_effective_at',
        'actor',
        'actor_name',
        'actor_role',
        'member_name',
        'section',
        'year_level',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'effective_at' => 'datetime',
        'previous_effective_at' => 'datetime',
    ];

    /**
     * Generation counter for Payment History's list cache (see
     * PaymentController::index) — every cached page/filter combination is
     * keyed against this, so bumping it once invalidates all of them at
     * once instead of enumerating which cached keys a given write affects.
     */
    private const CACHE_VERSION_KEY = 'payment_transactions.cache_version';

    protected static function booted(): void
    {
        // Covers a single write (Application::recordPaymentTransaction's
        // ->create()). Bulk writes go around Eloquent events entirely — see
        // MemberController::bulkSetPayment/bulkSetBothPayments, which call
        // bumpCacheVersion() themselves right after their bulk insert.
        static::created(fn () => self::bumpCacheVersion());
    }

    public static function cacheVersion(): int
    {
        return (int) Cache::get(self::CACHE_VERSION_KEY, 0);
    }

    public static function bumpCacheVersion(): void
    {
        Cache::forever(self::CACHE_VERSION_KEY, self::cacheVersion() + 1);
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * The semester this fee belongs to. Copied onto the row rather than read
     * through the member, for the same reason member_name and section are: the
     * member can be force-deleted, and a past semester's figures must not move.
     */
    public function membershipTerm(): BelongsTo
    {
        return $this->belongsTo(MembershipTerm::class);
    }

    /** @param  Builder<PaymentTransaction>  $query */
    public function scopeForTerm(Builder $query, int $termId): Builder
    {
        return $query->where('membership_term_id', $termId);
    }

    /**
     * Narrow to a combined year+section code (e.g. "3A"), the same codes and
     * mapping the Members List filters on — see Application::scopeInClass. An
     * unknown code is a no-op, so a bad filter value never silently empties
     * the ledger.
     *
     * @param  Builder<PaymentTransaction>  $query
     */
    public function scopeInClass(Builder $query, string $code): Builder
    {
        if (! isset(Application::CLASS_MAP[$code])) {
            return $query;
        }

        [$year, $section] = Application::CLASS_MAP[$code];

        return $query->where('year_level', $year)->where('section', $section);
    }

    /**
     * This ledger is the audit trail, not the source of the collected totals.
     *
     * Those are derived from applications.paid_at (see PaymentSummary), because
     * summing signed ledger rows would misreport a back-dated correction: moving
     * a payment from June to July has to move the fee between buckets, which a
     * running sum only gets right if every adjustment writes a perfectly paired
     * reversal. Deriving from current state cannot drift.
     *
     * `amount` is therefore descriptive — what this event did to the total at
     * the time — and is displayed per row rather than aggregated.
     *
     * @param  Builder<PaymentTransaction>  $query
     */
    public function scopeAction(Builder $query, string $action): Builder
    {
        return $query->where('action', $action);
    }
}
