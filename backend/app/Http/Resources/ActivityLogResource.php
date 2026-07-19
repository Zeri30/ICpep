<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One activity-history entry.
 *
 * @mixin ActivityLog
 */
class ActivityLogResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'description' => $this->description,
            // Name first, falling back to the recorded email for entries with no
            // account behind them (the "Website" pseudo-actor, or a row written
            // before names were captured).
            'actorName' => $this->actor_name ?: $this->actor,
            'actor' => $this->actor,
            'actorRole' => $this->actor_role,
            'actorRoleLabel' => $this->actor_role
                ? (UserRole::tryFrom($this->actor_role)?->label() ?? $this->actor_role)
                : null,
            // ip_address is still recorded, but deliberately not exposed — the
            // log is read by officers, and an address identifies nobody to them.
            'applicant' => $this->applicant,
            'createdAt' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
