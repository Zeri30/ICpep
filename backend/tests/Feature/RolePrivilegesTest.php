<?php

namespace Tests\Feature;

use App\Enums\Permission;
use App\Enums\UserRole;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\RolePermission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Privileges — the Programming Team editing the role→permission matrix from
 * User Management.
 *
 * Two things matter here. First, that a grant is real: it changes what the API
 * lets an account do, immediately, for every account holding that role — not
 * just what the UI draws. Second, that the narrow scope holds: paid/unpaid is
 * the only ability the panel may move today, so everything else must survive a
 * request that tries to change it, `users.manage` above all.
 */
class RolePrivilegesTest extends TestCase
{
    use RefreshDatabase;

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

    /**
     * Save a role's abilities the way the panel does — the full list, fixed rows
     * included.
     *
     * @param  list<Permission>  $permissions
     */
    private function save(UserRole $role, array $permissions): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->putJson("/api/admin/users/roles/{$role->value}", [
                'permissions' => array_map(fn (Permission $p): string => $p->value, $permissions),
            ])
            ->assertOk();
    }

    /** A role's defaults plus paid/unpaid — the one edit the panel allows. */
    private function withPayment(UserRole $role): array
    {
        return [...$role->defaultPermissions(), Permission::UpdatePayment];
    }

    /* ------------------------------------------------------------ the concept */

    public function test_granting_payment_to_the_president_role_lets_a_president_toggle_payment(): void
    {
        Storage::fake('supabase');

        // Before: the President cannot touch payment status.
        $before = $this->member();
        $this->actingAs($this->acting(UserRole::President))
            ->postJson("/api/admin/members/{$before->id}/toggle-paid")
            ->assertForbidden();

        $this->save(UserRole::President, $this->withPayment(UserRole::President));

        // After: they can — and so can a *different* President account, because
        // the grant belongs to the role rather than the row it was opened from.
        $after = $this->member();
        $this->actingAs($this->acting(UserRole::President))
            ->postJson("/api/admin/members/{$after->id}/toggle-paid", ['batch' => 1])
            ->assertOk();

        $this->assertNotNull($after->fresh()->paid_at);
    }

    public function test_a_granted_role_can_also_change_payment_through_the_edit_form(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        $this->save(UserRole::Secretary, $this->withPayment(UserRole::Secretary));

        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/members/{$member->id}", [
                'surname' => 'Dela Cruz', 'givenName' => 'Juan', 'middleInitial' => 'S',
                'studentId' => '1234567890',
                'yearLevel' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
                'address' => '123 Rizal St', 'email' => 'juan@example.com', 'phone' => '09123456789',
                'paidAt' => now()->toIso8601String(),
            ])
            ->assertOk();

        $this->assertNotNull($member->fresh()->paid_at);
    }

    public function test_granting_edit_to_a_view_only_role_lets_it_delete_and_restore_members(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        // Before: the PRO is view-only.
        $this->actingAs($this->acting(UserRole::Pro))
            ->deleteJson("/api/admin/members/{$member->id}")
            ->assertForbidden();

        $this->save(UserRole::Pro, [...UserRole::Pro->defaultPermissions(), Permission::EditMembers]);

        // After: they can delete — and undo it, since the two travel together.
        $this->actingAs($this->acting(UserRole::Pro))
            ->deleteJson("/api/admin/members/{$member->id}")
            ->assertOk();
        $this->assertSoftDeleted('applications', ['id' => $member->id]);

        $this->actingAs($this->acting(UserRole::Pro))
            ->postJson("/api/admin/members/{$member->id}/restore")
            ->assertOk();
        $this->assertNotSoftDeleted('applications', ['id' => $member->id]);
    }

    public function test_revoking_edit_from_the_secretary_role_leaves_them_read_only(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        $this->save(UserRole::Secretary, [Permission::ViewMembers]);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->deleteJson("/api/admin/members/{$member->id}")
            ->assertForbidden();

        // Reading the module still works — only the writing was taken away.
        $this->actingAs($this->acting(UserRole::Secretary))
            ->getJson('/api/admin/members')
            ->assertOk();
    }

    public function test_revoking_payment_from_the_treasurer_role_takes_it_away(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        // The Treasurer's defaults minus paid/unpaid.
        $this->save(UserRole::Treasurer, [Permission::ViewMembers, Permission::AccessFinance]);

        $this->actingAs($this->acting(UserRole::Treasurer))
            ->postJson("/api/admin/members/{$member->id}/toggle-paid")
            ->assertForbidden();

        $this->assertNull($member->fresh()->paid_at);

        // Their other abilities are untouched — Payment History still opens.
        $this->actingAs($this->acting(UserRole::Treasurer))
            ->getJson('/api/admin/payments')
            ->assertOk();
    }

    public function test_the_officers_own_permission_list_reflects_the_change(): void
    {
        $this->save(UserRole::Bod, $this->withPayment(UserRole::Bod));

        $this->actingAs($this->acting(UserRole::Bod))
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.permissions', ['members.view', 'members.payment', 'finance.view']);
    }

    /* ------------------------------------------------------- the fixed abilities */

    /** Every ability is now grantable, so a view-only role can be given the lot. */
    public function test_a_view_only_role_can_be_granted_everything(): void
    {
        $this->save(UserRole::Pro, Permission::cases());

        $this->assertEqualsCanonicalizing(Permission::cases(), UserRole::Pro->permissions());

        $pro = $this->acting(UserRole::Pro);
        $this->actingAs($pro)->getJson('/api/admin/users')->assertOk();
        $this->actingAs($pro)->getJson('/api/admin/payments')->assertOk();
        $this->actingAs($pro)->postJson('/api/admin/registration/close', ['reason' => 'Nope'])->assertOk();
    }

    /* ---------------------------------------------------------------- finance */

    /**
     * The ledger and the money are two ticks, not one. Granting Payment History
     * opens the record of who has paid and nothing else — the revenue figures
     * stay hidden until the second ability is granted as well.
     */
    public function test_granting_payment_history_does_not_uncover_the_revenue(): void
    {
        $pro = $this->acting(UserRole::Pro);

        // Start from a role stripped of finance entirely — Payment History is
        // in every role's defaults, so the grant has to be observed from below.
        $this->save(UserRole::Pro, [Permission::ViewMembers]);

        $this->actingAs($pro)->getJson('/api/admin/payments')->assertForbidden();
        $this->actingAs($pro)->getJson('/api/admin/dashboard')
            ->assertOk()->assertJsonPath('canViewRevenue', false);

        $this->save(UserRole::Pro, [Permission::ViewMembers, Permission::AccessFinance]);

        // The ledger opens; the dashboard money does not follow it.
        $this->actingAs($pro)->getJson('/api/admin/payments')->assertOk();
        $this->actingAs($pro)->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('canViewRevenue', false)
            ->assertJsonPath('stats.revenue', null);
    }

    /** And the reverse: the revenue can be granted without opening the ledger. */
    public function test_granting_revenue_does_not_open_payment_history(): void
    {
        $this->member();
        $pro = $this->acting(UserRole::Pro);

        $this->save(UserRole::Pro, [Permission::ViewMembers, Permission::ViewRevenue]);

        $this->actingAs($pro)->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('canViewRevenue', true);

        $this->actingAs($pro)->getJson('/api/admin/payments')->assertForbidden();
    }

    public function test_revoking_finance_closes_payment_history_and_hides_the_figures(): void
    {
        // The Treasurer's defaults minus finance.
        $this->save(UserRole::Treasurer, [Permission::ViewMembers, Permission::UpdatePayment]);

        $treasurer = $this->acting(UserRole::Treasurer);

        $this->actingAs($treasurer)->getJson('/api/admin/payments')->assertForbidden();
        $this->actingAs($treasurer)->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('canViewRevenue', false)
            ->assertJsonPath('stats.revenue', null)
            ->assertJsonPath('paymentSummary', null);

        // Recording payments is a separate ability and survives.
        Storage::fake('supabase');
        $member = $this->member();

        $this->actingAs($treasurer)
            ->postJson("/api/admin/members/{$member->id}/toggle-paid", ['batch' => 1])
            ->assertOk();
    }

    public function test_sending_an_empty_list_leaves_a_role_with_nothing(): void
    {
        // Every ability is grantable, so an empty list really does mean none —
        // including the President's control of the membership cycle.
        $this->save(UserRole::President, []);
        $this->assertSame([], UserRole::President->permissions());

        $president = $this->acting(UserRole::President);
        $this->actingAs($president)->getJson('/api/admin/members')->assertForbidden();
        $this->actingAs($president)->postJson('/api/admin/registration/close', ['reason' => 'x'])->assertForbidden();

        // Still signed in, and reset puts it all back.
        $this->actingAs($president)->getJson('/api/admin/activity')->assertOk();

        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/users/roles/president/reset')
            ->assertOk();

        $this->assertSame(UserRole::President->defaultPermissions(), UserRole::President->permissions());
    }

    /* ------------------------------------------------------ the members module */

    public function test_revoking_view_closes_the_members_module_entirely(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        $this->save(UserRole::Secretary, []);

        $secretary = $this->acting(UserRole::Secretary);
        $this->actingAs($secretary)->getJson('/api/admin/members')->assertForbidden();
        $this->actingAs($secretary)->getJson("/api/admin/members/{$member->id}")->assertForbidden();

        // Still an administrator — the modules that never needed members.view
        // are untouched.
        $this->actingAs($secretary)->getJson('/api/admin/dashboard')->assertOk();
        $this->actingAs($secretary)->getJson('/api/admin/activity')->assertOk();
    }

    public function test_granting_view_back_reopens_it(): void
    {
        Storage::fake('supabase');
        $this->member();

        $this->save(UserRole::Secretary, []);
        $this->actingAs($this->acting(UserRole::Secretary))->getJson('/api/admin/members')->assertForbidden();

        $this->save(UserRole::Secretary, [Permission::ViewMembers]);
        $this->actingAs($this->acting(UserRole::Secretary))->getJson('/api/admin/members')->assertOk();
    }

    public function test_edit_and_payment_are_dropped_without_view(): void
    {
        // Ask for the writes but not the read they are gated behind. Keeping
        // them would promise access every member route refuses.
        $this->save(UserRole::Secretary, [Permission::EditMembers, Permission::UpdatePayment]);

        $this->assertSame([], UserRole::Secretary->permissions());

        Storage::fake('supabase');
        $member = $this->member();

        $this->actingAs($this->acting(UserRole::Secretary))
            ->deleteJson("/api/admin/members/{$member->id}")
            ->assertForbidden();

        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson("/api/admin/members/{$member->id}/toggle-paid")
            ->assertForbidden();
    }

    public function test_a_hand_written_row_cannot_grant_edit_without_view(): void
    {
        RolePermission::create([
            'role' => UserRole::Pro->value,
            'permissions' => ['members.edit'],
        ]);
        RolePermission::flush();

        $this->assertSame([], UserRole::Pro->permissions());
    }

    /**
     * Rows record the whole submitted set, fixed abilities included. Storing
     * only the editable ones would make an absent ability mean "use the
     * default" — and the day it became editable, every existing row would read
     * as a deliberate revocation of it.
     */
    public function test_a_saved_row_records_the_whole_submitted_set(): void
    {
        $this->save(UserRole::President, UserRole::President->defaultPermissions());

        $stored = RolePermission::query()->where('role', 'president')->value('permissions');

        $this->assertEqualsCanonicalizing(
            ['members.view', 'members.edit', 'finance.view', 'terms.manage'],
            $stored,
        );
    }

    /**
     * Asserted entry by entry rather than with assertJsonFragment, which matches
     * each key/value anywhere in the response — it will happily satisfy
     * ['value' => 'users.manage', 'editable' => false] from two *different*
     * entries, and did, hiding the fact that users.manage had become editable.
     */
    public function test_the_catalog_describes_each_ability_accurately(): void
    {
        $catalog = collect(
            $this->actingAs($this->acting(UserRole::ProgrammingTeam))
                ->getJson('/api/admin/users/roles')
                ->assertOk()
                ->json('permissions')
        )->keyBy('value');

        // Every ability is the panel's to grant or revoke.
        foreach (Permission::cases() as $permission) {
            $this->assertTrue(
                $catalog[$permission->value]['editable'],
                "{$permission->value} should be editable",
            );
        }

        // Which abilities are gated behind reaching the Members module.
        $this->assertNull($catalog['members.view']['requires']);
        $this->assertSame('members.view', $catalog['members.edit']['requires']);
        $this->assertSame('members.view', $catalog['members.payment']['requires']);
        $this->assertNull($catalog['finance.view']['requires']);
    }

    public function test_account_management_can_be_granted_to_another_role(): void
    {
        $president = $this->acting(UserRole::President);

        $this->actingAs($president)->getJson('/api/admin/users')->assertForbidden();

        $this->save(UserRole::President, [...UserRole::President->defaultPermissions(), Permission::ManageUsers]);

        $this->actingAs($president)->getJson('/api/admin/users')->assertOk();
    }

    /**
     * Granting account management grants everything, in effect: the role can now
     * open the Privileges panel and hand itself any other ability. Asserted
     * rather than merely warned about, so the consequence is on record.
     */
    public function test_a_granted_role_can_then_change_the_matrix_itself(): void
    {
        $this->save(UserRole::President, [...UserRole::President->defaultPermissions(), Permission::ManageUsers]);

        // A President now edits privileges — and gives their own role finance.
        $this->actingAs($this->acting(UserRole::President))
            ->putJson('/api/admin/users/roles/president', [
                'permissions' => [
                    ...array_map(fn (Permission $p): string => $p->value, UserRole::President->defaultPermissions()),
                    Permission::ManageUsers->value,
                    Permission::AccessFinance->value,
                ],
            ])
            ->assertOk();

        $this->assertContains(Permission::AccessFinance, UserRole::President->permissions());
    }

    /* ------------------------------------------------------------ lockout guard */

    public function test_cannot_remove_account_management_from_your_own_role(): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->putJson('/api/admin/users/roles/programming_team', [
                'permissions' => [Permission::ViewMembers->value],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You cannot remove account management from your own role — you would lose the ability to put it back. Ask another administrator, or move it to a different role first.');

        // Untouched, so the module is still reachable.
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->getJson('/api/admin/users')
            ->assertOk();
    }

    public function test_reset_cannot_strand_account_management_either(): void
    {
        // Customize the Programming Team so a reset is a real change, then try
        // to reset it from a Programming Team account — the defaults keep the
        // ability, so this one is allowed and must still work.
        $this->save(UserRole::ProgrammingTeam, [Permission::ViewMembers, Permission::ManageUsers]);

        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/users/roles/programming_team/reset')
            ->assertOk();

        // A role that only holds it by grant loses it on reset — allowed,
        // because the Programming Team still has it.
        $this->save(UserRole::President, [...UserRole::President->defaultPermissions(), Permission::ManageUsers]);

        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/users/roles/president/reset')
            ->assertOk();

        $this->assertNotContains(Permission::ManageUsers, UserRole::President->permissions());
    }

    public function test_another_role_can_be_stripped_of_it_while_the_team_still_holds_it(): void
    {
        $this->save(UserRole::President, [...UserRole::President->defaultPermissions(), Permission::ManageUsers]);

        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->putJson('/api/admin/users/roles/president', [
                'permissions' => array_map(
                    fn (Permission $p): string => $p->value,
                    UserRole::President->defaultPermissions(),
                ),
            ])
            ->assertOk();

        $this->actingAs($this->acting(UserRole::President))
            ->getJson('/api/admin/users')
            ->assertForbidden();
    }

    /* -------------------------------------------------------------- the module */

    public function test_only_the_programming_team_may_read_or_change_privileges(): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->getJson('/api/admin/users/roles')
            ->assertOk()
            ->assertJsonPath('roles.0.value', 'programming_team')
            ->assertJsonCount(count(Permission::cases()), 'permissions');

        foreach ([UserRole::President, UserRole::Treasurer, UserRole::Pro] as $role) {
            $this->actingAs($this->acting($role))
                ->getJson('/api/admin/users/roles')
                ->assertForbidden();

            $this->actingAs($this->acting($role))
                ->putJson("/api/admin/users/roles/{$role->value}", ['permissions' => Permission::values()])
                ->assertForbidden();
        }
    }

    public function test_the_panel_reports_how_many_accounts_a_change_reaches(): void
    {
        $this->acting(UserRole::Bod);
        $this->acting(UserRole::Bod);

        // Read the one entry rather than assertJsonFragment, which would match
        // these three values across three different roles. See the note on
        // test_the_catalog_describes_each_ability_accurately.
        $bod = collect(
            $this->actingAs($this->acting(UserRole::ProgrammingTeam))
                ->getJson('/api/admin/users/roles')
                ->assertOk()
                ->json('roles')
        )->firstWhere('value', 'bod');

        $this->assertSame(2, $bod['accountCount']);
        $this->assertFalse($bod['customized']);
    }

    public function test_reset_puts_a_role_back_on_its_defaults(): void
    {
        $this->save(UserRole::Secretary, $this->withPayment(UserRole::Secretary));
        $this->assertTrue(RolePermission::isCustomized(UserRole::Secretary));

        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/users/roles/secretary/reset')
            ->assertOk()
            ->assertJsonPath('customized', false)
            // Scheduling and Payment History are both part of the Secretary's
            // defaults — they keep the organization's calendar and its records,
            // so a reset must hand both back. Seeing the revenue is not.
            ->assertJsonPath('permissions', ['members.view', 'members.edit', 'finance.view', 'schedule.manage']);
    }

    public function test_an_unknown_role_is_a_404(): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))
            ->putJson('/api/admin/users/roles/wizard', ['permissions' => []])
            ->assertNotFound();
    }

    /* ------------------------------------------------------------ audit trail */

    public function test_the_change_is_logged_naming_the_abilities_that_moved(): void
    {
        $this->save(UserRole::President, $this->withPayment(UserRole::President));

        $log = ActivityLog::query()->where('action', 'privileges_updated')->firstOrFail();

        $this->assertStringContainsString('President', $log->description);
        $this->assertStringContainsString('granted Update payment status', $log->description);
        $this->assertStringNotContainsString('revoked', $log->description);
    }

    public function test_a_no_op_save_is_not_logged(): void
    {
        $this->save(UserRole::Adviser, UserRole::Adviser->defaultPermissions());

        $this->assertDatabaseMissing('activity_logs', ['action' => 'privileges_updated']);
    }
}
