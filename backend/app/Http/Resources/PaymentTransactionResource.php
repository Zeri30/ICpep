<?php

namespace App\Http\Resources;

use App\Models\PaymentTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the payment-history ledger. `amount` is descriptive (what the event
 * did to the total at the time) and shown per row, never summed — see the note
 * on PaymentTransaction.
 *
 * @mixin PaymentTransaction
 */
class PaymentTransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'memberName' => $this->member_name,
            'section' => $this->section,
            'yearLevel' => $this->year_level,
            'action' => $this->action,
            'amount' => (float) $this->amount,
            'effectiveAt' => optional($this->effective_at)->toIso8601String(),
            'previousEffectiveAt' => optional($this->previous_effective_at)->toIso8601String(),
            'recordedAt' => optional($this->created_at)->toIso8601String(),
            'actor' => $this->actor,
            // Which semester this event belongs to — badges the Event column
            // "(Current)" or a school-year label, same as the Activity Log.
            // Null only for rows written before terms existed.
            'paymentTerm' => $this->membershipTerm ? [
                'isCurrent' => $this->membershipTerm->is_current,
                'shortLabel' => sprintf(
                    '%02d-%02d, Sem %d',
                    $this->membershipTerm->school_year_from % 100,
                    $this->membershipTerm->school_year_to % 100,
                    $this->membershipTerm->semester,
                ),
            ] : null,
        ];
    }
}
