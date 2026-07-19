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
            'action' => $this->action,
            'amount' => (float) $this->amount,
            'effectiveAt' => optional($this->effective_at)->toIso8601String(),
            'previousEffectiveAt' => optional($this->previous_effective_at)->toIso8601String(),
            'recordedAt' => optional($this->created_at)->toIso8601String(),
            'actor' => $this->actor,
        ];
    }
}
