<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One membership-fee event. Written by Application's model events, never by
 * hand — see App\Models\Application::booted().
 */
class PaymentTransaction extends Model
{
    public const PAID = 'paid';

    public const REVOKED = 'revoked';

    public const ADJUSTED = 'adjusted';

    protected $fillable = [
        'application_id',
        'membership_term_id',
        'action',
        'amount',
        'effective_at',
        'previous_effective_at',
        'actor',
        'member_name',
        'section',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'effective_at' => 'datetime',
        'previous_effective_at' => 'datetime',
    ];

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
