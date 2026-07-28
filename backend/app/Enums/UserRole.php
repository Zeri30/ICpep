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
        // Every role below holds Permission::AccessFinance. Payment History is
        // open to the whole board on purpose: the chapter's record of who has
        // paid their dues is something any officer may be asked about, and a
        // ledger only two people can open invites the question of what is in
        // it. It is read-only wherever it appears — recording a payment needs
        // members.payment, and the revenue figures need finance.revenue, both
        // of which stay with the treasury.
        return match ($this) {
            // Full non-financial access, plus managing officer accounts. Account
            // management is deliberately limited to this one role: officers who
            // need an account created, edited or reset go through them.
            self::ProgrammingTeam => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::AccessFinance,
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
                Permission::AccessFinance,
                Permission::ManageTerms,
            ],
            // The secretariat keeps the organization's calendar. Scheduling is
            // theirs by default — every other role reads the calendar and
            // cannot change it. The Assistant Secretary holds it on the same
            // terms as the Secretary: the post exists to cover the Secretary's
            // work, and a schedule only one person can touch stops the week
            // they are unwell.
            //
            // The two roles are deliberately one entry rather than two
            // identical ones, so that "whatever the Secretary can do, the
            // Assistant Secretary can also do" is a property of the code and
            // not of someone remembering to change both.
            //
            // Like every role they read Payment History, and like every role
            // outside the treasury they do not see the revenue. That split is
            // the reason the two finance abilities are separate at all (see
            // Permission::ViewRevenue): the secretariat keeps the
            // organization's records, and who has paid is one of them, but the
            // takings are the treasury's business.
            self::Secretary, self::AssistantSecretary => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::AccessFinance,
                Permission::ManageSchedule,
            ],
            // Full member access; cannot manage accounts or the cycle.
            self::Adviser => [
                Permission::ViewMembers,
                Permission::EditMembers,
                Permission::AccessFinance,
            ],
            // The treasury: read members, run payments, and the only roles that
            // see the chapter's money — the revenue figures on the dashboard,
            // on top of the ledger everyone reads.
            self::Treasurer, self::AssistantTreasurer => [
                Permission::ViewMembers,
                Permission::UpdatePayment,
                Permission::AccessFinance,
                Permission::ViewRevenue,
            ],
            // View-only access to the admin panel: the member roster and the
            // payment ledger, and nothing they can change.
            self::Pro, self::Bod => [
                Permission::ViewMembers,
                Permission::AccessFinance,
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
