<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The sidebar's nav badges (/api/admin/counts) — unread since this officer
 * last opened each module, not the module's total. See ModuleView.
 */
class DashboardCountsTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): User
    {
        return User::factory()->programmingTeam()->create();
    }

    private function member(array $attributes = []): Application
    {
        return Application::create(array_merge([
            'membership_term_id' => MembershipTerm::current()?->id,
            'surname' => 'Dela Cruz',
            'given_name' => 'Juan',
            'middle_initial' => 'S',
            'year_level' => '3rd Year',
            'section' => 'Section A',
            'birthday' => '2005-01-01',
            'address' => '1 Rizal St., Bulacan',
            'email' => 'juan'.fake()->unique()->numberBetween(1, 99999).'@example.test',
            'phone' => '0917'.str_pad((string) fake()->unique()->numberBetween(1, 9999999), 7, '0', STR_PAD_LEFT),
            'signature_path' => 'signatures/x.jpg',
            'picture_path' => 'pictures/x.jpg',
        ], $attributes));
    }

    public function test_a_module_never_viewed_reports_its_full_count_as_unread(): void
    {
        $manager = $this->manager();
        $this->member();
        $this->member();

        $this->actingAs($manager)
            ->getJson('/api/admin/counts')
            ->assertOk()
            ->assertJsonPath('members', 2)
            // The acting manager is the only account so far.
            ->assertJsonPath('users', 1);
    }

    public function test_viewing_a_module_zeroes_its_badge_until_something_new_arrives(): void
    {
        $manager = $this->manager();
        $this->member();
        $this->member();

        $this->actingAs($manager)->getJson('/api/admin/counts')->assertJsonPath('members', 2);

        $this->actingAs($manager)
            ->postJson('/api/admin/me/views/members')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->actingAs($manager)->getJson('/api/admin/counts')->assertJsonPath('members', 0);

        // Only a record created *after* the view counts as unread again. Travel
        // forward first: both timestamps are otherwise second-precision and
        // land in the same wall-clock second in a test running this fast,
        // which would make "created after the view" a coin flip rather than
        // the deliberate `created_at > last_viewed_at` it actually is.
        $this->travel(1)->second();
        $this->member();

        $this->actingAs($manager)->getJson('/api/admin/counts')->assertJsonPath('members', 1);
    }

    public function test_the_view_marker_is_per_officer(): void
    {
        $viewer = $this->manager();
        $otherOfficer = $this->manager();
        $this->member();

        $this->actingAs($viewer)->postJson('/api/admin/me/views/members')->assertOk();

        $this->actingAs($viewer)->getJson('/api/admin/counts')->assertJsonPath('members', 0);
        // A different officer never viewed it, so it's still unread for them.
        $this->actingAs($otherOfficer)->getJson('/api/admin/counts')->assertJsonPath('members', 1);
    }

    public function test_marking_users_viewed_is_gated_by_the_same_permission_as_the_module(): void
    {
        $noAccess = User::factory()->create(); // default role: BOD, no users.manage

        $this->actingAs($noAccess)
            ->postJson('/api/admin/me/views/users')
            ->assertForbidden();
    }
}
