<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Enums\RoleFamily;
use App\Enums\UserRole;
use App\Models\Application;
use App\Models\RolePermission;
use App\Models\User;
use Database\Seeders\RoleAccountsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The Team Head roles, and the role directory they enlarged.
 *
 * The six Team Heads start on exactly what the Board of Directors holds, and the
 * point of these tests is the word *start*: they are six independent roles that
 * were given the board's abilities, not six aliases for the board. So the tests
 * that matter are the ones about what happens afterwards — change the board and
 * the Team Heads must not move; change one Team Head and the other five must not.
 *
 * The rest covers the directory itself: every role classified, every role
 * seedable, and the least-privileged role still the one a new account starts on.
 */
class TeamHeadRolesTest extends TestCase
{
    use RefreshDatabase;

    /** The six roles this module added. */
    private const TEAM_HEADS = [
        UserRole::ProgrammingTeamHead,
        UserRole::DocumentationTeamHead,
        UserRole::WritersTeamHead,
        UserRole::MultimediaTeamHead,
        UserRole::SocialMediaTeamHead,
        UserRole::EsportsTeamHead,
    ];

    private function acting(UserRole $role): User
    {
        return User::factory()->role($role)->create();
    }

    private function member(): Application
    {
        return Application::create([
            'surname' => 'Dela Cruz', 'given_name' => 'Juan', 'middle_initial' => 'S',
            'year_level' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
            'address' => '123 Rizal St', 'email' => 'juan@example.com', 'phone' => '09123456789',
            'signature_path' => 'signatures/x.png', 'picture_path' => 'pictures/x.png',
        ]);
    }

    /** Save a role's abilities the way the Privileges panel does. */
    private function save(UserRole $role, array $permissions): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->putJson("/api/admin/users/roles/{$role->value}", [
                'permissions' => array_map(fn (Permission $p): string => $p->value, $permissions),
            ])
            ->assertOk();
    }

    /** @return list<string> */
    private function values(UserRole $role): array
    {
        return array_map(fn (Permission $p): string => $p->value, $role->permissions());
    }

    /* ---------------------------------------------------------------- the roles */

    public function test_the_six_team_head_roles_exist(): void
    {
        $this->assertCount(18, UserRole::cases());

        foreach (self::TEAM_HEADS as $role) {
            $this->assertNotNull(UserRole::tryFrom($role->value));
            $this->assertStringEndsWith('Team Head', $role->label());
        }
    }

    /** The role selector is built from meta.roles, so being listed there is the test. */
    public function test_every_role_reaches_the_role_selector_with_its_family(): void
    {
        $roles = $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->json('meta.roles');

        $this->assertCount(18, $roles);
        $this->assertEqualsCanonicalizing(
            UserRole::values(),
            array_column($roles, 'value'),
        );

        // Each option carries everything the UI needs to draw it: the label, the
        // family it is coloured and grouped by, and whether it manages accounts.
        foreach ($roles as $option) {
            $this->assertNotSame('', $option['label']);
            $this->assertContains($option['family'], RoleFamily::values());
            $this->assertNotSame('', $option['familyLabel']);
            $this->assertIsBool($option['managesUsers']);
        }

        // The flag is read from the live matrix, not a list in the UI — today
        // exactly one role holds account management.
        $managers = array_column(array_filter($roles, fn (array $o): bool => $o['managesUsers']), 'value');
        $this->assertSame(['programming_team'], $managers);
    }

    /**
     * The headings are sent in their own order, because inferring it from the
     * roles puts whichever family the first role belongs to on top — which put
     * Technical above Executive, the Programming Team being declared first.
     */
    public function test_the_family_headings_arrive_in_their_own_order(): void
    {
        $families = $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->json('meta.roleFamilies');

        $this->assertSame(RoleFamily::values(), array_column($families, 'value'));
        $this->assertSame('executive', $families[0]['value']);
        $this->assertSame('technical', $families[count($families) - 1]['value']);
    }

    public function test_every_role_belongs_to_a_family_and_every_family_has_a_role(): void
    {
        $used = [];

        foreach (UserRole::cases() as $role) {
            // An unclassified role would be a fatal on the match, so reaching
            // here at all is most of the assertion.
            $used[] = $role->family();
        }

        // A family nobody is in would be a heading the role selects never draw
        // and a colour nothing ever wears.
        foreach (RoleFamily::cases() as $family) {
            $this->assertContains($family, $used, "No role belongs to the {$family->value} family.");
        }
    }

    /** Where the six landed. Written out because the grouping is a judgement, not a rule. */
    public function test_the_team_heads_are_classified_by_the_work_they_do(): void
    {
        $this->assertSame(RoleFamily::Technical, UserRole::ProgrammingTeamHead->family());
        $this->assertSame(RoleFamily::Secretariat, UserRole::DocumentationTeamHead->family());
        $this->assertSame(RoleFamily::Communications, UserRole::WritersTeamHead->family());
        $this->assertSame(RoleFamily::Communications, UserRole::MultimediaTeamHead->family());
        $this->assertSame(RoleFamily::Communications, UserRole::SocialMediaTeamHead->family());
        $this->assertSame(RoleFamily::Technical, UserRole::EsportsTeamHead->family());

        // The board is its own family — the Team Heads sit under it, not in it.
        $this->assertSame(RoleFamily::Governance, UserRole::Bod->family());
    }

    /* ---------------------------------------------------- the same set as the board */

    public function test_each_team_head_holds_exactly_what_the_board_holds(): void
    {
        $board = $this->values(UserRole::Bod);

        // Not an empty set by accident: the board reads the members and the
        // ledger, and that is what the Team Heads were given.
        $this->assertSame(['members.view', 'finance.view'], $board);

        foreach (self::TEAM_HEADS as $role) {
            $this->assertSame($board, $this->values($role), "{$role->value} does not match the board.");
            $this->assertSame($board, array_map(
                fn (Permission $p): string => $p->value,
                $role->defaultPermissions(),
            ));
        }
    }

    public function test_a_team_head_reads_the_members_and_the_ledger_and_changes_neither(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        foreach (self::TEAM_HEADS as $role) {
            $officer = $this->acting($role);

            $this->actingAs($officer)->getJson('/api/admin/members')->assertOk();
            $this->actingAs($officer)->getJson('/api/admin/payments')->assertOk();

            // View-only: no member edits, no payments, no accounts, no calendar.
            $this->actingAs($officer)->deleteJson("/api/admin/members/{$member->id}")->assertForbidden();
            $this->actingAs($officer)->postJson("/api/admin/members/{$member->id}/toggle-paid")->assertForbidden();
            $this->actingAs($officer)->getJson('/api/admin/users')->assertForbidden();
            $this->actingAs($officer)->getJson('/api/admin/users/roles')->assertForbidden();
            $this->actingAs($officer)->postJson('/api/admin/events', [])->assertForbidden();
        }

        $this->assertNotSoftDeleted($member);
    }

    /* ----------------------------------------------------------- and independent */

    /**
     * The decision this module was asked to make. The Team Heads were given the
     * board's abilities once, at creation; they do not track it. Granting the
     * board something new must leave all six exactly where they were.
     */
    public function test_changing_the_board_does_not_change_the_team_heads(): void
    {
        $before = array_map(fn (UserRole $r): array => $this->values($r), self::TEAM_HEADS);

        $this->save(UserRole::Bod, [
            Permission::ViewMembers,
            Permission::EditMembers,
            Permission::AccessFinance,
            Permission::ViewRevenue,
        ]);

        // The board really did move — otherwise this test proves nothing.
        $this->assertSame(
            ['members.view', 'members.edit', 'finance.view', 'finance.revenue'],
            $this->values(UserRole::Bod),
        );

        foreach (self::TEAM_HEADS as $i => $role) {
            $this->assertSame($before[$i], $this->values($role), "{$role->value} followed the board.");
        }

        // And the abilities the board gained are genuinely not theirs to use.
        Storage::fake('supabase');
        $member = $this->member();

        $this->actingAs($this->acting(UserRole::ProgrammingTeamHead))
            ->deleteJson("/api/admin/members/{$member->id}")
            ->assertForbidden();
    }

    /** Revoking from the board is the same story in the other direction. */
    public function test_stripping_the_board_does_not_strip_the_team_heads(): void
    {
        $this->save(UserRole::Bod, []);

        $this->assertSame([], $this->values(UserRole::Bod));

        foreach (self::TEAM_HEADS as $role) {
            $this->assertSame(['members.view', 'finance.view'], $this->values($role));
        }

        $this->actingAs($this->acting(UserRole::EsportsTeamHead))
            ->getJson('/api/admin/payments')
            ->assertOk();
    }

    public function test_each_team_head_is_edited_on_its_own(): void
    {
        $this->save(UserRole::MultimediaTeamHead, [Permission::ViewMembers]);

        $this->assertTrue(RolePermission::isCustomized(UserRole::MultimediaTeamHead));
        $this->assertSame(['members.view'], $this->values(UserRole::MultimediaTeamHead));

        // The other five, and the board, are untouched.
        foreach (self::TEAM_HEADS as $role) {
            if ($role === UserRole::MultimediaTeamHead) {
                continue;
            }

            $this->assertFalse(RolePermission::isCustomized($role));
            $this->assertSame(['members.view', 'finance.view'], $this->values($role));
        }

        $this->assertFalse(RolePermission::isCustomized(UserRole::Bod));

        // Its own row, so its own reset — back to the board's set, not to
        // whatever the board happens to hold by then.
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/users/roles/multimedia_team_head/reset')
            ->assertOk()
            ->assertJsonPath('customized', false)
            ->assertJsonPath('permissions', ['members.view', 'finance.view']);
    }

    /**
     * A Team Head can be granted an ability the board does not have, which is the
     * practical shape of "adjusted separately".
     */
    public function test_a_team_head_can_be_given_something_the_board_lacks(): void
    {
        $this->save(UserRole::ProgrammingTeamHead, [
            Permission::ViewMembers,
            Permission::AccessFinance,
            Permission::ManageSchedule,
        ]);

        $this->assertContains('schedule.manage', $this->values(UserRole::ProgrammingTeamHead));
        $this->assertNotContains('schedule.manage', $this->values(UserRole::Bod));

        $this->actingAs($this->acting(UserRole::ProgrammingTeamHead))
            ->postJson('/api/admin/events', [])
            // Reached the validator rather than the gate — the ability is real.
            ->assertStatus(422);
    }

    /* -------------------------------------------------------------- new accounts */

    /**
     * A new account starts on the least-privileged role, and the API says which
     * that is rather than the form inferring it from the order of the list — the
     * bug the Team Heads would otherwise have introduced by being declared last.
     */
    public function test_the_account_form_is_told_which_role_a_new_account_starts_on(): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('meta.defaultRole', 'bod');

        $this->assertSame(UserRole::Bod, UserRole::default());

        // Least-privileged means exactly that: nothing it can change.
        foreach (UserRole::default()->permissions() as $permission) {
            $this->assertContains($permission, [Permission::ViewMembers, Permission::AccessFinance]);
        }
    }

    /* ------------------------------------------------------------------ seeding */

    public function test_the_seeder_creates_an_account_for_every_role_and_four_for_the_board(): void
    {
        $this->seed(RoleAccountsSeeder::class);

        // Seventeen single-seat roles plus four directors.
        $this->assertSame(21, User::query()->count());

        foreach (UserRole::cases() as $role) {
            $accounts = User::query()->where('role', $role->value)->get();

            $this->assertCount(
                $role === UserRole::Bod ? 4 : 1,
                $accounts,
                "Wrong number of seeded accounts for {$role->value}.",
            );

            foreach ($accounts as $account) {
                $this->assertTrue($account->is_active);
                $this->assertNotNull($account->email_verified_at);
                // The name is a placeholder for the officer's real one, but it
                // must at least say which role it stands for.
                $this->assertStringStartsWith($role->label(), $account->name);
            }
        }
    }

    public function test_the_seeded_addresses_read_sensibly(): void
    {
        $this->seed(RoleAccountsSeeder::class);

        $emails = User::query()->orderBy('id')->pluck('email')->all();

        // The six new ones, spelled out — an address is printed on things and
        // read aloud, so a generated one is worth pinning down.
        $this->assertContains('programming.team.head@icpep.se', $emails);
        $this->assertContains('documentation.team.head@icpep.se', $emails);
        $this->assertContains('writers.team.head@icpep.se', $emails);
        $this->assertContains('multimedia.team.head@icpep.se', $emails);
        $this->assertContains('social.media.team.head@icpep.se', $emails);
        $this->assertContains('esports.team.head@icpep.se', $emails);

        // The board's first seat keeps the plain address it has always had; the
        // additional directors are numbered after it.
        $this->assertContains('bod@icpep.se', $emails);
        $this->assertContains('bod.2@icpep.se', $emails);
        $this->assertContains('bod.3@icpep.se', $emails);
        $this->assertContains('bod.4@icpep.se', $emails);

        // Every address unique, and every one on the chapter's domain.
        $this->assertSame($emails, array_values(array_unique($emails)));
        foreach ($emails as $email) {
            $this->assertStringEndsWith('@icpep.se', $email);
        }
    }

    /**
     * The seeder is re-run whenever a role is added, and by then the accounts it
     * created earlier are in use — signed into, renamed, password changed. It must
     * add the missing ones and touch nothing else.
     */
    public function test_re_running_the_seeder_leaves_existing_accounts_alone(): void
    {
        $this->seed(RoleAccountsSeeder::class);

        $director = User::query()->where('email', 'bod@icpep.se')->firstOrFail();
        $director->update([
            'name' => 'Juan Dela Cruz',
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'password' => Hash::make('a-password-of-their-own'),
            'is_active' => false,
        ]);
        $hash = $director->fresh()->password;

        // The run that would happen after a role is added.
        User::query()->where('email', 'esports.team.head@icpep.se')->delete();
        $this->seed(RoleAccountsSeeder::class);

        $this->assertSame(21, User::query()->count());
        $this->assertDatabaseHas('users', ['email' => 'esports.team.head@icpep.se']);

        $director = $director->fresh();
        $this->assertSame('Juan Dela Cruz', $director->name);
        $this->assertSame('Dela Cruz', $director->last_name);
        $this->assertFalse($director->is_active);
        $this->assertSame($hash, $director->password, 'The seeder reset an existing password.');
    }
}
