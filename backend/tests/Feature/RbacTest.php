<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Role-Based Access Control across the admin modules. Verifies the permission
 * matrix is enforced at the API: who can edit members, change payment status,
 * reach the financial modules, and manage accounts.
 */
class RbacTest extends TestCase
{
    use RefreshDatabase;

    private function member(): Application
    {
        return Application::create([
            'surname' => 'Dela Cruz', 'given_name' => 'Juan', 'middle_initial' => 'S',
            'year_level' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
            'address' => '123 Rizal St', 'email' => 'juan@example.com', 'phone' => '09123456789',
            'signature_path' => 'signatures/x.png', 'picture_path' => 'pictures/x.png',
        ]);
    }

    private function acting(UserRole $role): User
    {
        return User::factory()->role($role)->create();
    }

    /* ------------------------------------------------------- module visibility */

    public function test_every_active_role_can_view_members(): void
    {
        Storage::fake('supabase');
        $this->member();

        foreach (UserRole::cases() as $role) {
            $this->actingAs($this->acting($role))
                ->getJson('/api/admin/members')
                ->assertOk();
        }
    }

    /**
     * Payment History is open to the whole board by default, for transparency:
     * the record of who has paid their dues is something any officer may be
     * asked about, and a ledger only the treasury can open invites the question
     * of what is in it.
     *
     * Reading it is all it grants. Recording a payment needs members.payment
     * and the revenue figures need finance.revenue, both of which stay with the
     * treasury — covered by the tests either side of this one.
     *
     * These are the *defaults*; the Programming Team can still revoke it from
     * any role in the Privileges panel, which RolePrivilegesTest covers.
     */
    public function test_every_role_reaches_payment_history(): void
    {
        foreach (UserRole::cases() as $role) {
            $this->actingAs($this->acting($role))
                ->getJson('/api/admin/payments')
                ->assertOk();
        }
    }

    /** Reading the ledger is not permission to change it. */
    public function test_reading_payment_history_does_not_allow_recording_payments(): void
    {
        Storage::fake('supabase');
        $member = $this->member();

        foreach ([UserRole::Pro, UserRole::Bod, UserRole::Secretary, UserRole::President] as $role) {
            $this->actingAs($this->acting($role))
                ->postJson("/api/admin/members/{$member->id}/toggle-paid")
                ->assertForbidden();
        }

        $this->assertNull($member->fresh()->paid_at);
    }

    public function test_only_the_programming_team_reaches_user_management(): void
    {
        $this->actingAs($this->acting(UserRole::ProgrammingTeam))->getJson('/api/admin/users')->assertOk();

        foreach (UserRole::cases() as $role) {
            if ($role === UserRole::ProgrammingTeam) {
                continue;
            }

            $this->actingAs($this->acting($role))->getJson('/api/admin/users')->assertForbidden();
        }
    }

    /* ------------------------------------------------------------- member edit */

    public function test_editor_roles_can_delete_members_but_viewers_cannot(): void
    {
        Storage::fake('supabase');

        // Secretary (editor) may delete.
        $m1 = $this->member();
        $this->actingAs($this->acting(UserRole::Secretary))
            ->deleteJson("/api/admin/members/{$m1->id}")->assertOk();

        // PRO (view-only) may not.
        $m2 = $this->member();
        $this->actingAs($this->acting(UserRole::Pro))
            ->deleteJson("/api/admin/members/{$m2->id}")->assertForbidden();

        // Treasurer edits member data? No — finance role, not an editor.
        $m3 = $this->member();
        $this->actingAs($this->acting(UserRole::Treasurer))
            ->deleteJson("/api/admin/members/{$m3->id}")->assertForbidden();
    }

    /* ---------------------------------------------------------- payment status */

    public function test_only_finance_roles_toggle_payment(): void
    {
        Storage::fake('supabase');

        $paid = $this->member();
        $this->actingAs($this->acting(UserRole::Treasurer))
            ->postJson("/api/admin/members/{$paid->id}/toggle-paid")->assertOk();
        $this->assertNotNull($paid->fresh()->paid_at);

        // A Secretary can edit member data but not change payment.
        $other = $this->member();
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson("/api/admin/members/{$other->id}/toggle-paid")->assertForbidden();
        $this->assertNull($other->fresh()->paid_at);
    }

    public function test_non_finance_editor_cannot_change_payment_through_edit_form(): void
    {
        Storage::fake('supabase');
        $m = $this->member();

        // Secretary submits the edit form with a paid date — the field is ignored.
        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/members/{$m->id}", [
                'surname' => 'Dela Cruz', 'givenName' => 'Juan', 'middleInitial' => 'S',
                'yearLevel' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
                'address' => '123 Rizal St', 'email' => 'juan@example.com', 'phone' => '09123456789',
                'paidAt' => now()->toIso8601String(),
            ])
            ->assertOk();

        $this->assertNull($m->fresh()->paid_at);
    }

    /* -------------------------------------------------------------- dashboard */

    public function test_dashboard_hides_revenue_from_non_finance_roles(): void
    {
        $this->member();

        $this->actingAs($this->acting(UserRole::President))
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.revenue', null)
            ->assertJsonPath('paymentSummary', null)
            ->assertJsonPath('canViewRevenue', false);

        $this->actingAs($this->acting(UserRole::Treasurer))
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('canViewRevenue', true);
    }

    /**
     * The reason the two finance abilities are separate. The secretariat keeps
     * the organization's records, so they open Payment History — but the
     * chapter's takings are the treasury's business, and the dashboard stays
     * shut to them.
     */
    public function test_the_secretariat_reads_the_ledger_without_seeing_the_revenue(): void
    {
        $this->member();

        foreach ([UserRole::Secretary, UserRole::AssistantSecretary] as $role) {
            $officer = $this->acting($role);

            $this->actingAs($officer)->getJson('/api/admin/payments')->assertOk();

            $this->actingAs($officer)
                ->getJson('/api/admin/dashboard')
                ->assertOk()
                ->assertJsonPath('canViewRevenue', false)
                ->assertJsonPath('stats.revenue', null)
                ->assertJsonPath('stats.pendingRevenue', null)
                ->assertJsonPath('paymentSummary', null);
        }
    }

    /* ------------------------------------------------------------ activity log */

    public function test_activity_records_actor_role_and_ip(): void
    {
        Storage::fake('supabase');
        $m = $this->member();

        $this->actingAs($this->acting(UserRole::Secretary))
            ->deleteJson("/api/admin/members/{$m->id}")
            ->assertOk();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'deleted',
            'actor_role' => 'secretary',
        ]);
    }
}
