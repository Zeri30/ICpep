<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    private function entry(string $when): ActivityLog
    {
        $log = ActivityLog::create([
            'actor' => 'officer@example.test',
            'actor_name' => 'Officer',
            'action' => 'updated',
            'description' => 'Did a thing',
        ]);
        // created_at isn't mass-assignable (not in $fillable) — set directly so
        // the from/until range has something other than "now" to filter on.
        $log->forceFill(['created_at' => $when])->save();

        return $log;
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
}
