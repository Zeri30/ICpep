<?php

namespace App\Enums;

use App\Models\RolePermission;

/**
 * Administrator roles for the organization's officer positions. Each role maps
 * to a set of {@see Permission}s; that mapping is the single source of truth for
 * what a role may do, consumed by the Gates, middleware and the frontend alike.
 *
 * The mapping below is the *default*. The Programming Team edits the live one
 * from the Privileges panel in User Management, which stores overrides in
 * `role_permissions` — so a grant applies to the role, and therefore to every
 * account holding it.
 *
 * The set is open to extension: add a case here, give it a label and a default
 * permission set, and seed an account for it — the rest of the system adapts.
 */
enum UserRole: string
{
    case ProgrammingTeam = 'programming_team';
    case President = 'president';
    case Adviser = 'adviser';
    case Vpea = 'vpea';
    case Vpia = 'vpia';
    case Secretary = 'secretary';
    case AssistantSecretary = 'assistant_secretary';
    case Treasurer = 'treasurer';
    case AssistantTreasurer = 'assistant_treasurer';
    case Pro = 'pro';
    case Bod = 'bod';

    public function label(): string
    {
        return match ($this) {
            self::ProgrammingTeam => 'Programming Team',
            self::President => 'President',
            self::Adviser => 'Adviser',
            self::Vpea => 'VP for External Affairs',
            self::Vpia => 'VP for Internal Affairs',
            self::Secretary => 'Secretary',
            self::AssistantSecretary => 'Assistant Secretary',
            self::Treasurer => 'Treasurer',
            self::AssistantTreasurer => 'Assistant Treasurer',
            self::Pro => 'Public Relations Officer',
            self::Bod => 'Board of Directors',
        };
    }

    /**
     * The abilities this role actually holds right now.
     *
     * Resolved through {@see RolePermission}, so the Programming Team can grant
     * or revoke abilities from the Privileges panel without a code change. A
     * role nobody has customized falls back to {@see self::defaultPermissions()}.
     *
     * @return list<Permission>
     */
    public function permissions(): array
    {
        return RolePermission::resolve($this);
    }

    /**
     * The abilities this role ships with — the starting point the Privileges
     * panel offers as "reset to defaults", and the permanent home of any locked
     * ability (see {@see Permission::isLocked()}).
     *
     * @return list<Permission>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            // Full non-financial access, plus managing officer accounts. Account
            // management is deliberately limited to this one role: officers who
            // need an account created, edited or reset go through them.
            self::ProgrammingTeam => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::ManageUsers,
                Permission::ManageTerms,
            ],
            // The executive roles. Same member access as the other editors, plus
            // control of the membership cycle — creating each semester's list and
            // opening/closing the public registration form. The Programming Team
            // shares it so a technical fault can be acted on without waiting for
            // an officer.
            self::President, self::Vpea, self::Vpia => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::ManageTerms,
            ],
            // The Secretary keeps the organization's calendar. Scheduling is
            // theirs alone by default — every other role reads the calendar and
            // cannot change it. Deliberately not shared with the Assistant
            // Secretary: if the chapter wants a second pair of hands on the
            // schedule, the Programming Team grants it from the Privileges
            // panel rather than it being assumed here.
            self::Secretary => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::ManageSchedule,
            ],
            // Full non-financial access; cannot manage accounts or the cycle.
            self::Adviser, self::AssistantSecretary => [
                Permission::ViewMembers,
                Permission::EditMembers,
            ],
            // Financial roles: read members, run payments and the money modules.
            self::Treasurer, self::AssistantTreasurer => [
                Permission::ViewMembers,
                Permission::UpdatePayment,
                Permission::AccessFinance,
            ],
            // View-only access to the admin panel.
            self::Pro, self::Bod => [
                Permission::ViewMembers,
            ],
        };
    }

    public function hasPermission(Permission $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }

    /** May this role reach User Management and act on accounts? */
    public function managesUsers(): bool
    {
        return $this->hasPermission(Permission::ManageUsers);
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(fn (self $r): string => $r->value, self::cases());
    }

    /** @return list<array{value:string,label:string}> for the frontend selects. */
    public static function options(): array
    {
        return array_map(fn (self $r): array => ['value' => $r->value, 'label' => $r->label()], self::cases());
    }
}
