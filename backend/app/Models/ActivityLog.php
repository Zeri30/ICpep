<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLog extends Model
{
    protected $fillable = ['actor', 'actor_name', 'actor_role', 'ip_address', 'action', 'description', 'applicant'];

    /**
     * Recorded for the audit trail like everything else, but never surfaced in
     * the Activity Log UI for anyone — a "remember me" cookie being rotated or
     * revoked is an internal implementation detail of RememberMeService, not
     * something any officer needs to read about.
     */
    public const ALWAYS_HIDDEN_ACTIONS = ['remember_token_reused'];

    /**
     * Recorded for every role, but only ever displayed to the Programming
     * Team — sign-in/out, failed sign-ins, password resets, and account
     * activation/deactivation/deletion are system/internal activity that
     * would clutter the log for every other officer. Still written for every
     * role via {@see self::record()}, so the audit trail itself is unaffected
     * — only who can read these particular rows back.
     */
    public const PROGRAMMING_TEAM_ONLY_ACTIONS = [
        'login', 'logout', 'login_failed', 'password_reset',
        'user_activated', 'user_deactivated', 'user_deleted',
    ];

    /**
     * Which `action` values $viewer's Activity Log should never show —
     * {@see self::ALWAYS_HIDDEN_ACTIONS} for everyone, plus
     * {@see self::PROGRAMMING_TEAM_ONLY_ACTIONS} for every role except the
     * Programming Team.
     *
     * @return list<string>
     */
    public static function hiddenActionsFor(?User $viewer): array
    {
        return $viewer?->role === UserRole::ProgrammingTeam
            ? self::ALWAYS_HIDDEN_ACTIONS
            : [...self::ALWAYS_HIDDEN_ACTIONS, ...self::PROGRAMMING_TEAM_ONLY_ACTIONS];
    }

    /**
     * Record an activity entry, tagging the current admin (name + email + role)
     * and the originating IP so every change is traceable to who did it.
     *
     * The name is stored, not looked up on read, so the entry still identifies
     * the officer after the account is renamed or removed.
     */
    public static function record(string $action, string $description, ?string $applicant = null): void
    {
        $user = Auth::user();

        static::create([
            'actor' => $user?->email ?? 'Website',
            'actor_name' => $user?->name,
            'actor_role' => $user?->role?->value,
            'ip_address' => request()?->ip(),
            'action' => $action,
            'description' => $description,
            'applicant' => $applicant,
        ]);
    }
}
