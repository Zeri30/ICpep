<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    private function entry(string $when, string $action = 'updated'): ActivityLog
    {
        $log = ActivityLog::create([
            'actor' => 'officer@example.test',
            'actor_name' => 'Officer',
            'action' => $action,
            'description' => 'Did a thing',
        ]);
        // created_at isn't mass-assignable (not in $fillable) — set directly so
        // the from/until range has something other than "now" to filter on.
        $log->forceFill(['created_at' => $when])->save();

        return $log;
    }

    /* ---------------------------------------------------------- payment writes */

    /**
     * Payment History (payment_transactions) is the dedicated ledger for
     * paid/unpaid events — they used to also write an Activity Log entry, but
     * that duplicated the same information in two places.
     */
    public function test_marking_paid_does_not_write_to_the_activity_log(): void
    {
        $member = Application::create([
            'membership_term_id' => MembershipTerm::current()?->id,
            'surname' => 'Dela Cruz', 'given_name' => 'Juan', 'middle_initial' => 'S',
            'year_level' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
            'address' => '123 Rizal St', 'email' => 'a@example.com', 'phone' => '09123456789',
            'signature_path' => 'signatures/x.png', 'picture_path' => 'pictures/x.png',
        ]);

        $member->update(['paid_at' => now()]);
        $member->update(['paid_at' => null]);

        $this->assertSame(0, ActivityLog::whereIn('action', ['paid', 'unpaid'])->count());
        $this->assertSame(2, $member->paymentTransactions()->count());
    }

    public function test_from_and_until_narrow_to_the_inclusive_range(): void
    {
        $this->entry('2026-07-01 10:00:00');
        $this->entry('2026-07-15 10:00:00');
        $this->entry('2026-07-31 10:00:00');

        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/activity?from=2026-07-10&until=2026-07-20')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_from_alone_is_an_open_ended_lower_bound(): void
    {
        $this->entry('2026-07-01 10:00:00');
        $this->entry('2026-07-31 10:00:00');

        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/activity?from=2026-07-15')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    /* --------------------------------------------------------- unread badge */

    public function test_activity_badge_reports_unread_and_clears_on_view(): void
    {
        $officer = User::factory()->create();
        $this->entry(now()->toDateTimeString());
        $this->entry(now()->toDateTimeString());

        $this->actingAs($officer)->getJson('/api/admin/counts')->assertJsonPath('activity', 2);

        $this->actingAs($officer)->postJson('/api/admin/me/views/activity')->assertOk();
        $this->actingAs($officer)->getJson('/api/admin/counts')->assertJsonPath('activity', 0);

        $this->travel(1)->second();
        $this->entry(now()->toDateTimeString());

        $this->actingAs($officer)->getJson('/api/admin/counts')->assertJsonPath('activity', 1);
    }

    /** Unlike members/payments/users, the log itself needs no permission — so
        neither does marking it viewed. */
    public function test_marking_activity_viewed_needs_no_special_permission(): void
    {
        $anyActiveOfficer = User::factory()->create();

        $this->actingAs($anyActiveOfficer)
            ->postJson('/api/admin/me/views/activity')
            ->assertOk();
    }

    /* ------------------------------------------------ role-restricted actions */

    /**
     * Sign-in/out, failed sign-ins, password resets, and account
     * activation/deactivation/deletion are still written for every role (see
     * UserManagementTest and AdminApiTest for the write side) — only reading
     * them back through the Activity Log is restricted to the Programming
     * Team. See ActivityLog::PROGRAMMING_TEAM_ONLY_ACTIONS.
     */
    public function test_system_actions_are_hidden_from_every_role_but_the_programming_team(): void
    {
        foreach (ActivityLog::PROGRAMMING_TEAM_ONLY_ACTIONS as $action) {
            $this->entry(now()->toDateTimeString(), $action);
        }
        $this->entry(now()->toDateTimeString(), 'updated');

        $notProgrammingTeam = User::factory()->create(); // default role: BOD

        $this->actingAs($notProgrammingTeam)
            ->getJson('/api/admin/activity')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'updated');

        // The dropdown filter can't be used to bypass the restriction either.
        foreach (ActivityLog::PROGRAMMING_TEAM_ONLY_ACTIONS as $action) {
            $this->actingAs($notProgrammingTeam)
                ->getJson("/api/admin/activity?action={$action}")
                ->assertOk()
                ->assertJsonCount(0, 'data');
        }
    }

    public function test_system_actions_are_visible_to_the_programming_team(): void
    {
        foreach (ActivityLog::PROGRAMMING_TEAM_ONLY_ACTIONS as $action) {
            $this->entry(now()->toDateTimeString(), $action);
        }

        $this->actingAs(User::factory()->programmingTeam()->create())
            ->getJson('/api/admin/activity')
            ->assertOk()
            ->assertJsonCount(count(ActivityLog::PROGRAMMING_TEAM_ONLY_ACTIONS), 'data');
    }

    /**
     * A "remember me" cookie being rotated or revoked is an internal
     * implementation detail (see RememberMeService) — unlike the
     * Programming-Team-only actions above, no role ever sees it in the log,
     * the Programming Team included.
     */
    public function test_remember_token_reused_is_hidden_from_every_role(): void
    {
        $this->entry(now()->toDateTimeString(), 'remember_token_reused');
        $this->entry(now()->toDateTimeString(), 'updated');

        foreach ([User::factory()->create(), User::factory()->programmingTeam()->create()] as $officer) {
            $this->actingAs($officer)
                ->getJson('/api/admin/activity')
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.action', 'updated');
        }
    }

    /** The sidebar's unread badge must agree with what the log itself shows —
        otherwise it would advertise "new activity" a role can't actually see. */
    public function test_the_unread_badge_does_not_count_hidden_actions(): void
    {
        $notProgrammingTeam = User::factory()->create(); // default role: BOD

        $this->entry(now()->toDateTimeString(), 'login');
        $this->entry(now()->toDateTimeString(), 'remember_token_reused');
        $this->entry(now()->toDateTimeString(), 'updated');

        $this->actingAs($notProgrammingTeam)
            ->getJson('/api/admin/counts')
            ->assertJsonPath('activity', 1);
    }
}
