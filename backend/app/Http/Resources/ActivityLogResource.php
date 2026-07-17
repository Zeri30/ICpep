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
            'actor' => $this->actor,
            'actorRole' => $this->actor_role,
            'actorRoleLabel' => $this->actor_role
                ? (UserRole::tryFrom($this->actor_role)?->label() ?? $this->actor_role)
                : null,
            'ipAddress' => $this->ip_address,
            'applicant' => $this->applicant,
            'createdAt' => optional($this->created_at)->toIso8601String(),
        ];
    }
}
