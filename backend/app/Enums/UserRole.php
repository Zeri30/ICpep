<?php

namespace App\Enums;

/**
 * Administrator roles for the organization's officer positions. Each role maps
 * to a set of {@see Permission}s; that mapping is the single source of truth for
 * what a role may do, consumed by the Gates, middleware and the frontend alike.
 *
 * The set is open to extension: add a case here, give it a label and a
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
     * The abilities this role is granted.
     *
     * @return list<Permission>
     */
    public function permissions(): array
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
            // Full non-financial access; cannot manage accounts or the cycle.
            self::Adviser, self::Secretary, self::AssistantSecretary => [
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
