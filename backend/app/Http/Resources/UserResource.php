<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An administrator account as the User Management screen consumes it. Never
 * exposes the password hash (it is `$hidden` on the model regardless).
 *
 * @mixin User
 */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'role' => $this->role?->value,
            'roleLabel' => $this->role?->label(),
            'isActive' => (bool) $this->is_active,
            'lastLoginAt' => optional($this->last_login_at)->toIso8601String(),
            'createdAt' => optional($this->created_at)->toIso8601String(),
            // Lets the UI disable the self-destructive actions on the caller's
            // own row without a second lookup.
            'isSelf' => $request->user()?->id === $this->id,
        ];
    }
}
