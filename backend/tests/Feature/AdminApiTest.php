<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The JSON admin API that backs the React admin. Auth is the session `web`
 * guard restricted to the configured ADMIN_EMAIL (EnsureAdmin).
 */
class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    /** The bootstrap Programming Team account (full non-financial + user mgmt). */
    private function admin(): User
    {
        return User::factory()->programmingTeam()->create(['email' => env('ADMIN_EMAIL', 'admin@example.com')]);
    }

    /** A Treasurer — the role that may touch payments and financial modules. */
    private function treasurer(): User
    {
        return User::factory()->treasurer()->create();
    }

    /**
     * A member of the current membership list — which is where the public form
     * files everyone, and what the admin modules show by default. Tests that
     * care about a specific semester pass membership_term_id explicitly.
     */
    private function makeApplication(array $overrides = []): Application
    {
        return Application::create(array_merge([
            'membership_term_id' => MembershipTerm::current()?->id,
            'surname' => 'Dela Cruz',
            'given_name' => 'Juan',
            'middle_initial' => 'S',
            'year_level' => '3rd Year',
            'section' => 'Section A',
            'birthday' => '2004-01-01',
            'address' => '123 Rizal St',
            'email' => 'juan@example.com',
            'phone' => '09123456789',
            'signature_path' => 'signatures/x.png',
            'picture_path' => 'pictures/x.png',
        ], $overrides));
    }

    /* ------------------------------------------------------------------ auth */

    public function test_admin_api_requires_authentication(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
        $this->getJson('/api/admin/members')->assertUnauthorized();
    }

    public function test_deactivated_account_is_forbidden(): void
    {
        $deactivated = User::factory()->inactive()->create(['email' => 'someone-else@example.com']);

        $this->actingAs($deactivated)->getJson('/api/admin/me')->assertForbidden();
    }

    public function test_me_returns_officer_and_meta(): void
    {
        $this->actingAs($this->admin())
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.email', env('ADMIN_EMAIL', 'admin@example.com'))
            ->assertJsonPath('meta.fee', 50)
            ->assertJsonPath('meta.currency', '₱')
            ->assertJsonPath('meta.classOptions', ['3A', '3B', '4A', '4B']);
    }

    public function test_login_returns_the_react_admin_url(): void
    {
        $admin = $this->admin();
        $admin->forceFill(['password' => bcrypt('secret1234')])->save();

        $this->postJson('/auth/admin/login', ['email' => $admin->email, 'password' => 'secret1234'])
            ->assertOk()
            ->assertJsonPath('redirect', rtrim(config('app.frontend_url'), '/').'/admin');
    }

    public function test_logout_clears_the_session_and_returns_landing(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/auth/admin/logout')
            ->assertOk()
            ->assertJsonPath('redirect', config('app.frontend_url'));

        $this->assertGuest();
    }

    /* ------------------------------------------------------------- dashboard */

    public function test_dashboard_numbers_match_the_data(): void
    {
        $this->makeApplication(['year_level' => '3rd Year', 'paid_at' => now()]);
        $this->makeApplication(['email' => 'b@example.com', 'year_level' => '4th Year']);

        // Revenue is only returned to finance roles.
        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.members', 2)
            ->assertJsonPath('stats.thirdYear', 1)
            ->assertJsonPath('stats.fourthYear', 1)
            ->assertJsonPath('stats.paid', 1)
            ->assertJsonPath('stats.revenue', 50)
            ->assertJsonCount(4, 'membersByClass.data')
            ->assertJsonCount(6, 'registrationsOverTime.data');
    }

    /* --------------------------------------------------------------- members */

    public function test_members_list_filters_by_class_and_payment(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['surname' => 'ThreeA', 'email' => '3a@example.com', 'year_level' => '3rd Year', 'section' => 'Section A', 'paid_at' => now()]);
        $this->makeApplication(['surname' => 'ThreeB', 'email' => '3b@example.com', 'year_level' => '3rd Year', 'section' => 'Section B']);
        $this->makeApplication(['surname' => 'FourA', 'email' => '4a@example.com', 'year_level' => '4th Year', 'section' => 'Section A']);

        $admin = $this->admin();

        // Year & Section filter.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?class=3A')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.classCode', '3A');

        // Payment filter.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?payment=unpaid')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_members_list_searches_and_excludes_trashed_by_default(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['surname' => 'Findable', 'email' => 'find@example.com']);
        $removed = $this->makeApplication(['surname' => 'Removed', 'email' => 'gone@example.com']);
        $removed->delete();

        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/admin/members?search=Findable')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Soft-deleted hidden by default, visible under the "only" trashed scope.
        $this->actingAs($admin)->getJson('/api/admin/members')->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/admin/members?trashed=only')->assertJsonCount(1, 'data');
    }

    public function test_member_show_includes_signed_file_urls(): void
    {
        Storage::fake('supabase');
        $member = $this->makeApplication();

        $this->actingAs($this->admin())
            ->getJson("/api/admin/members/{$member->id}")
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Dela Cruz, Juan, S.')
            ->assertJsonStructure(['data' => ['pictureUrl', 'signatureUrl']]);
    }

    /* ---------------------------------------------------- payments & activity */

    public function test_payments_ledger_lists_and_filters(): void
    {
        // Marking paid writes a 'paid' ledger row via the model event.
        $this->makeApplication(['section' => 'Section A'])->update(['paid_at' => now()]);

        // Payment History is a financial module — Treasurer roles only.
        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?action=paid')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'paid')
            ->assertJsonPath('data.0.amount', 50);
    }

    public function test_activity_log_lists_and_filters_by_action(): void
    {
        $this->makeApplication(); // logs a 'registered' entry

        $this->actingAs($this->admin())
            ->getJson('/api/admin/activity?action=registered')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'registered');
    }

    /* ---------------------------------------------------------- member writes */

    public function test_toggle_paid_flips_state_and_logs(): void
    {
        $member = $this->makeApplication();
        $admin = $this->treasurer();

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/toggle-paid")->assertOk();
        $this->assertNotNull($member->fresh()->paid_at);
        $this->assertDatabaseHas('activity_logs', ['action' => 'paid']);
        $this->assertDatabaseHas('payment_transactions', ['application_id' => $member->id, 'action' => 'paid']);

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/toggle-paid")->assertOk();
        $this->assertNull($member->fresh()->paid_at);
    }

    public function test_update_edits_details_and_logs_an_update(): void
    {
        $member = $this->makeApplication();

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/members/{$member->id}", [
                'surname' => 'Reyes',
                'givenName' => 'Ana',
                'middleInitial' => null,
                'yearLevel' => '4th Year',
                'section' => 'Section B',
                'birthday' => '2003-05-05',
                'address' => '9 New St',
                'email' => 'ana@example.com',
                'phone' => '09990001111',
                'paidAt' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Reyes, Ana');

        $this->assertDatabaseHas('activity_logs', ['action' => 'updated']);
    }

    public function test_delete_soft_deletes_and_restore_brings_back(): void
    {
        $member = $this->makeApplication();
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/members/{$member->id}")->assertOk();
        $this->assertSoftDeleted('applications', ['id' => $member->id]);

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/restore")->assertOk();
        $this->assertNotSoftDeleted('applications', ['id' => $member->id]);
    }

    public function test_bulk_mark_paid_preserves_existing_dates(): void
    {
        $unpaid = $this->makeApplication(['email' => 'u@example.com']);
        $paid = $this->makeApplication(['email' => 'p@example.com', 'paid_at' => now()->subDays(5)]);

        $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$unpaid->id, $paid->id], 'action' => 'paid'])
            ->assertOk()
            // `count` is the ids considered, not the rows changed — the admin
            // reports its own figure for what actually moved.
            ->assertJsonPath('count', 2);

        $this->assertNotNull($unpaid->fresh()->paid_at);
        // Already paid: the original date stands, and no second fee is recorded.
        $this->assertTrue($paid->fresh()->paid_at->isSameDay(now()->subDays(5)));
        $this->assertSame(0, $paid->paymentTransactions()->count());
    }

    /**
     * Payments are only ever applied to an explicit set of ids. The endpoint
     * that swept every member matching the current filters is gone — a single
     * click should not be able to rewrite a semester's payment records.
     */
    public function test_there_is_no_endpoint_that_pays_the_whole_filtered_set(): void
    {
        $this->makeApplication(['email' => 'a@example.com']);

        $response = $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/mark-all-paid', ['class' => '3A']);

        // Rejected — 405 rather than 404, since /members/{application} still
        // answers PATCH and DELETE on that path. What matters is the outcome:
        // no request pays a member the caller did not name.
        $this->assertGreaterThanOrEqual(400, $response->status());
        $this->assertSame(0, Application::whereNotNull('paid_at')->count());
    }
}
