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
 * The set is open to extension: add a case here, give it a label, a family and a
 * default permission set, and seed an account for it — the rest of the system
 * adapts. Every match in this enum is exhaustive, so a case added without those
 * fails loudly rather than defaulting to something nobody chose.
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
    case Auditor = 'auditor';
    case Pro = 'pro';
    case Bod = 'bod';

    // The Team Heads. Each one leads a working team under the board, and each is
    // a role of its own rather than a variant of Bod — see the note on their
    // entry in defaultPermissions().
    case ProgrammingTeamHead = 'programming_team_head';
    case DocumentationTeamHead = 'documentation_team_head';
    case WritersTeamHead = 'writers_team_head';
    case MultimediaTeamHead = 'multimedia_team_head';
    case SocialMediaTeamHead = 'social_media_team_head';
    case EsportsTeamHead = 'esports_team_head';

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
            self::Auditor => 'Auditor',
            self::Pro => 'Public Relations Officer',
            self::Bod => 'Board of Directors',
            self::ProgrammingTeamHead => 'Programming Team Head',
            self::DocumentationTeamHead => 'Documentation Team Head',
            self::WritersTeamHead => "Writer's Team Head",
            self::MultimediaTeamHead => 'Multimedia Team Head',
            self::SocialMediaTeamHead => 'Social Media Team Head',
            self::EsportsTeamHead => 'E-sports Team Head',
        };
    }

    /**
     * Which branch of the organization this role sits in.
     *
     * Presentation only — the admin colours role badges and groups the role
     * selects by this. Nothing authorizes on it; see {@see RoleFamily}.
     */
    public function family(): RoleFamily
    {
        return match ($this) {
            self::President, self::Adviser, self::Vpea, self::Vpia => RoleFamily::Executive,

            // Documentation keeps the chapter's written record, which is the
            // secretariat's work rather than a communications one — they write
            // things down, they do not publish them.
            self::Secretary, self::AssistantSecretary,
            self::DocumentationTeamHead => RoleFamily::Secretariat,

            self::Treasurer, self::AssistantTreasurer => RoleFamily::Finance,

            // Everything whose output is the chapter speaking publicly.
            self::Pro, self::WritersTeamHead, self::MultimediaTeamHead,
            self::SocialMediaTeamHead => RoleFamily::Communications,

            // Oversight rather than day-to-day treasury work, so it sits with
            // the board rather than in Finance alongside the Treasurer.
            self::Bod, self::Auditor => RoleFamily::Governance,

            // E-sports is the loosest fit of the seventeen: it is not technical
            // work in the way programming is. It sits here because the family
            // reads as "the teams that build and run things", which is what an
            // e-sports team does, and because inventing a seventh family for one
            // role defeats the point of having families at all.
            self::ProgrammingTeam, self::ProgrammingTeamHead,
            self::EsportsTeamHead => RoleFamily::Technical,
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
            // Same view-only footing as the board, plus the revenue figures —
            // reviewing them is the point of the role, unlike Pro/Bod who read
            // the ledger but not the totals. Still no UpdatePayment: auditing
            // the books and recording payments stay separate abilities.
            self::Auditor => [
                Permission::ViewMembers,
                Permission::AccessFinance,
                Permission::ViewRevenue,
            ],
            // The Team Heads start on the same footing as the Board of Directors
            // — read the members, read Payment History, change neither.
            //
            // Written out as its own entry rather than added to the Bod line
            // above, and that is the whole point: a Team Head is *given* what the
            // board has today, not tied to whatever the board has tomorrow. If
            // the officers later decide the board should be able to edit members,
            // the Team Heads do not quietly acquire it too — they are six
            // separate roles in the Privileges panel, adjusted one at a time.
            //
            // Contrast the Secretary / Assistant Secretary line, which shares an
            // entry precisely *because* those two are meant to move together.
            // Sharing or splitting an entry here is the decision, not an
            // accident of formatting.
            self::ProgrammingTeamHead, self::DocumentationTeamHead,
            self::WritersTeamHead, self::MultimediaTeamHead,
            self::SocialMediaTeamHead, self::EsportsTeamHead => [
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

    /**
     * The role a new account starts on: the least-privileged one, so an account
     * created without a deliberate choice can read and change nothing.
     *
     * Matches the `users.role` column default, and the account form preselects
     * it. Named rather than found by position — the form used to take the last
     * case in this enum, which was this role only until the day somebody added a
     * case after it.
     */
    public static function default(): self
    {
        return self::Bod;
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(fn (self $r): string => $r->value, self::cases());
    }

    /**
     * For the frontend selects. Carries the family so the options can be grouped
     * under its heading — with seventeen roles a flat list is a scroll, not a
     * choice — and so a role added here arrives in the UI already classified,
     * with nothing to keep in step on the other side.
     *
     * `managesUsers` rides along so the role badge can mark the roles that can
     * reach User Management. It is resolved through the live matrix rather than
     * assumed, because that ability is editable: a UI that hard-codes "the
     * Programming Team is the one that manages accounts" starts lying the moment
     * somebody grants it elsewhere in the Privileges panel.
     *
     * @return list<array{value:string,label:string,family:string,familyLabel:string,managesUsers:bool}>
     */
    public static function options(): array
    {
        return array_map(fn (self $r): array => [
            'value' => $r->value,
            'label' => $r->label(),
            'family' => $r->family()->value,
            'familyLabel' => $r->family()->label(),
            'managesUsers' => $r->managesUsers(),
        ], self::cases());
    }
}
