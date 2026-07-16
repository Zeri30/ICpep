<?php

namespace Tests\Feature;

use App\Models\Application;
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

    private function admin(): User
    {
        return User::factory()->create(['email' => env('ADMIN_EMAIL', 'admin@example.com')]);
    }

    private function makeApplication(array $overrides = []): Application
    {
        return Application::create(array_merge([
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

    public function test_non_admin_account_is_forbidden(): void
    {
        $outsider = User::factory()->create(['email' => 'someone-else@example.com']);

        $this->actingAs($outsider)->getJson('/api/admin/me')->assertForbidden();
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

        $this->actingAs($this->admin())
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

        $this->actingAs($this->admin())
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
}
