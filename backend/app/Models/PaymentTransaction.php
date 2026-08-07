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
     * PaymentController::index), one per term rather than one global
     * counter: PaymentController::filtered() scopes almost every request to
     * a single term (forTerm()), so nearly every cached page belongs to
     * exactly one term. Keying the version per term means a payment written
     * against term A only evicts term A's cached pages — term B's cached
     * pages, which a write to A never changed, are left alone instead of
     * being thrown away too.
     *
     * The `null` slot is the version for the untermed view (no `term` filter
     * applied, spanning every term at once — see PaymentController::filtered
     * when $term is null). Because that view's rows can come from any term,
     * a write to any single term has to bump this slot too, on top of its
     * own — see bumpCacheVersion().
     */
    private const CACHE_VERSION_KEY_PREFIX = 'payment_transactions.cache_version.';

    protected static function booted(): void
    {
        // Covers a single write (Application::recordPaymentTransaction's
        // ->create()). Bulk writes go around Eloquent events entirely — see
        // MemberController::bulkSetPayment/bulkSetBothPayments, which call
        // bumpCacheVersion() themselves right after their bulk insert.
        static::created(fn (self $transaction) => self::bumpCacheVersion($transaction->membership_term_id));
    }

    public static function cacheVersion(?int $termId): int
    {
        return (int) Cache::get(self::cacheVersionKey($termId), 0);
    }

    public static function bumpCacheVersion(?int $termId): void
    {
        Cache::forever(self::cacheVersionKey($termId), self::cacheVersion($termId) + 1);

        // A row written under a specific term also changes what the
        // untermed ("all terms") view would show, so that view's version
        // has to move too — only skipped when $termId is already null,
        // i.e. the write itself already bumped this exact slot above.
        if ($termId !== null) {
            Cache::forever(self::cacheVersionKey(null), self::cacheVersion(null) + 1);
        }
    }

    private static function cacheVersionKey(?int $termId): string
    {
        return self::CACHE_VERSION_KEY_PREFIX.($termId ?? 'all');
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
