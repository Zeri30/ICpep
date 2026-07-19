<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \App\Models\MembershipTerm
 */
class MembershipTermResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'schoolYearFrom' => $this->school_year_from,
            'schoolYearTo' => $this->school_year_to,
            'semester' => $this->semester,
            'label' => $this->label,
            'isCurrent' => $this->is_current,
            // Lets the selector show how full each list is without a second call.
            'memberCount' => $this->whenCounted('applications'),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
