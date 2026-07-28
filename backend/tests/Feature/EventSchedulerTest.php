<?php

namespace Tests\Feature;

use App\Enums\EventStatus;
use App\Enums\UserRole;
use App\Models\Event;
use App\Models\RolePermission;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The calendar: who may schedule events, and who may only read them.
 *
 * The rule the module exists to enforce is that the secretariat — the Secretary
 * and the Assistant Secretary — keeps the schedule and everyone else has a
 * view-only calendar, so most of what is checked here is the API refusing
 * writes, not the UI hiding buttons.
 */
class EventSchedulerTest extends TestCase
{
    use RefreshDatabase;

    private function acting(UserRole $role): User
    {
        return User::factory()->role($role)->create();
    }

    /** @return array<string, string> the event form's fields, as the UI sends them. */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'General Assembly',
            'category' => 'Meeting',
            'date' => '2026-09-15',
            'time' => '14:30',
            'endTime' => '16:30',
            'description' => 'First assembly of the semester.',
        ], $overrides);
    }

    private function scheduled(): Event
    {
        return Event::create([
            'title' => 'CPE Week Kickoff',
            'category' => 'Major Event',
            'starts_at' => Event::combine('2026-11-03', '09:00'),
            'ends_at' => Event::combine('2026-11-03', '11:00'),
        ]);
    }

    /* -------------------------------------------------------------- creating */

    public function test_the_secretary_can_schedule_an_event(): void
    {
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated()
            ->assertJsonPath('title', 'General Assembly')
            ->assertJsonPath('category', 'Meeting')
            ->assertJsonPath('date', '2026-09-15')
            ->assertJsonPath('time', '14:30')
            ->assertJsonPath('endTime', '16:30')
            ->assertJsonPath('timeRangeLabel', '2:30 PM – 4:30 PM');

        $this->assertDatabaseHas('events', ['title' => 'General Assembly']);
    }

    /**
     * The Assistant Secretary schedules on exactly the same terms — not a
     * reduced version of it — so the calendar keeps working when the Secretary
     * is away.
     */
    public function test_the_assistant_secretary_can_schedule_an_event(): void
    {
        $this->actingAs($this->acting(UserRole::AssistantSecretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated()
            ->assertJsonPath('title', 'General Assembly');

        $this->assertDatabaseHas('events', ['title' => 'General Assembly']);
    }

    public function test_the_end_time_must_be_after_the_start(): void
    {
        $secretary = $this->acting(UserRole::Secretary);

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['time' => '14:30', 'endTime' => '14:00']))
            ->assertJsonValidationErrors('endTime');

        // Equal is not a duration either.
        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['time' => '14:30', 'endTime' => '14:30']))
            ->assertJsonValidationErrors('endTime');

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['endTime' => '']))
            ->assertJsonValidationErrors('endTime');

        $this->assertDatabaseCount('events', 0);
    }

    /**
     * The whole point of the module: every other role, including the ones that
     * can otherwise edit member records and manage accounts, is view-only.
     * Checked against the API rather than the rendered UI — a hidden button is
     * not access control.
     */
    public function test_no_other_role_can_schedule_an_event(): void
    {
        foreach (UserRole::cases() as $role) {
            if (in_array($role, [UserRole::Secretary, UserRole::AssistantSecretary], true)) {
                continue;
            }

            $this->actingAs($this->acting($role))
                ->postJson('/api/admin/events', $this->payload())
                ->assertForbidden();
        }

        $this->assertDatabaseCount('events', 0);
    }

    public function test_the_event_form_rejects_incomplete_submissions(): void
    {
        $secretary = $this->acting(UserRole::Secretary);

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['title' => '']))
            ->assertJsonValidationErrors('title');

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['category' => 'Fiesta']))
            ->assertJsonValidationErrors('category');

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['date' => '15/09/2026']))
            ->assertJsonValidationErrors('date');

        $this->actingAs($secretary)
            ->postJson('/api/admin/events', $this->payload(['time' => 'half two']))
            ->assertJsonValidationErrors('time');
    }

    /* --------------------------------------------------------------- reading */

    public function test_every_role_can_read_the_calendar(): void
    {
        $this->scheduled();

        foreach (UserRole::cases() as $role) {
            $this->actingAs($this->acting($role))
                ->getJson('/api/admin/events')
                ->assertOk()
                ->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.title', 'CPE Week Kickoff');
        }
    }

    public function test_the_calendar_is_returned_soonest_first(): void
    {
        Event::create(['title' => 'Later', 'category' => 'Seminar', 'starts_at' => Event::combine('2026-12-01', '09:00')]);
        Event::create(['title' => 'Sooner', 'category' => 'Seminar', 'starts_at' => Event::combine('2026-10-01', '09:00')]);

        $this->actingAs($this->acting(UserRole::Pro))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Sooner')
            ->assertJsonPath('data.1.title', 'Later');
    }

    /* ---------------------------------------------------- editing / deleting */

    public function test_the_secretary_can_edit_and_delete_an_event(): void
    {
        $event = $this->scheduled();

        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/events/{$event->id}", $this->payload([
                'title' => 'CPE Week Kickoff (moved)',
                'date' => '2026-11-04',
                'time' => '10:00',
            ]))
            ->assertOk()
            ->assertJsonPath('title', 'CPE Week Kickoff (moved)')
            ->assertJsonPath('date', '2026-11-04')
            ->assertJsonPath('time', '10:00');

        $this->actingAs($this->acting(UserRole::Secretary))
            ->deleteJson("/api/admin/events/{$event->id}")
            ->assertOk();

        // Soft-deleted: gone from the calendar, still on the record.
        $this->assertSoftDeleted('events', ['id' => $event->id]);
        $this->assertDatabaseCount('events', 1);
    }

    public function test_other_roles_cannot_edit_or_delete_an_event(): void
    {
        $event = $this->scheduled();

        foreach ([UserRole::ProgrammingTeam, UserRole::President, UserRole::Adviser, UserRole::Pro] as $role) {
            $actor = $this->acting($role);

            $this->actingAs($actor)
                ->patchJson("/api/admin/events/{$event->id}", $this->payload())
                ->assertForbidden();

            $this->actingAs($actor)
                ->deleteJson("/api/admin/events/{$event->id}")
                ->assertForbidden();
        }

        $this->assertSame('CPE Week Kickoff', $event->fresh()->title);
    }

    /* ------------------------------------------------------------ timezone */

    /**
     * A 9:00 AM event is 9:00 AM to every officer who opens the calendar, and
     * lands on the day the Secretary picked — regardless of what the reader's
     * device clock is set to. That only holds because the API converts, rather
     * than handing the browser a UTC instant to interpret.
     */
    public function test_times_are_stored_as_utc_and_returned_in_the_organization_timezone(): void
    {
        config(['icpep.timezone' => 'Asia/Manila']);

        // An early-morning event is the case that catches a missing conversion:
        // 7 AM in Manila (UTC+8) is the *previous* day in UTC, so anything that
        // formats the stored instant without converting back shows the wrong
        // date on the calendar.
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload(['date' => '2026-11-03', 'time' => '07:00']))
            ->assertCreated()
            ->assertJsonPath('date', '2026-11-03')
            ->assertJsonPath('time', '07:00')
            ->assertJsonPath('timeLabel', '7:00 AM');

        $this->assertSame('2026-11-02 23:00:00', Event::first()->starts_at->utc()->format('Y-m-d H:i:s'));
    }

    /* ---------------------------------------------- attendance credentials */

    public function test_scheduling_an_event_generates_a_qr_token_and_attendance_code(): void
    {
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated()
            ->assertJsonPath('attendanceCode', fn (string $code): bool => strlen($code) === 6)
            ->assertJsonStructure(['qrUrl', 'attendanceCode']);

        $event = Event::first();

        $this->assertSame(6, strlen($event->attendance_code));
        $this->assertNotEmpty($event->qr_token);
        // The QR has to encode something a phone camera can resolve on its own.
        $this->assertStringContainsString($event->qr_token, $event->checkInUrl());
        $this->assertStringStartsWith('http', $event->checkInUrl());
    }

    /**
     * The code is read aloud in a room and typed on a phone, so the characters
     * that get heard or seen wrong — 0/O and 1/I/L — are kept out of it.
     */
    public function test_the_attendance_code_avoids_ambiguous_characters(): void
    {
        for ($i = 0; $i < 40; $i++) {
            $code = Event::freshAttendanceCode();

            $this->assertSame(6, strlen($code));
            $this->assertSame(
                '',
                preg_replace('/['.Event::CODE_ALPHABET.']/', '', $code),
                "Generated code {$code} contains a character outside the alphabet.",
            );
        }
    }

    public function test_credentials_are_unique_across_events(): void
    {
        $secretary = $this->acting(UserRole::Secretary);

        foreach (range(1, 12) as $i) {
            $this->actingAs($secretary)
                ->postJson('/api/admin/events', $this->payload(['title' => "Event {$i}"]))
                ->assertCreated();
        }

        $this->assertSame(12, Event::query()->distinct()->count('attendance_code'));
        $this->assertSame(12, Event::query()->distinct()->count('qr_token'));
    }

    /** Nothing is reserved by a form that is opened and then abandoned. */
    public function test_no_credentials_exist_until_the_event_is_saved(): void
    {
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload(['title' => '']))
            ->assertJsonValidationErrors('title');

        $this->assertDatabaseCount('events', 0);
    }

    /** Editing an event must not invalidate a code already handed out. */
    public function test_editing_an_event_keeps_its_credentials(): void
    {
        $event = $this->scheduled();
        $token = $event->qr_token;
        $code = $event->attendance_code;

        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/events/{$event->id}", $this->payload(['title' => 'Renamed']))
            ->assertOk();

        $event->refresh();
        $this->assertSame($token, $event->qr_token);
        $this->assertSame($code, $event->attendance_code);
    }

    /**
     * The token is the entire secret behind a check-in, and the calendar is
     * readable by everyone — so it must not travel in the payload they get.
     */
    public function test_credentials_are_hidden_from_roles_that_cannot_manage_the_schedule(): void
    {
        $this->scheduled();

        foreach ([UserRole::Pro, UserRole::President, UserRole::Adviser, UserRole::ProgrammingTeam] as $role) {
            $this->actingAs($this->acting($role))
                ->getJson('/api/admin/events')
                ->assertOk()
                ->assertJsonMissingPath('data.0.qrUrl')
                ->assertJsonMissingPath('data.0.attendanceCode');
        }

        $this->actingAs($this->acting(UserRole::Secretary))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonStructure(['data' => [['qrUrl', 'attendanceCode']]]);
    }

    /* --------------------------------------------------- status and timing */

    /** @return Event an event that many days from today, in the org's timezone. */
    private function eventInDays(int $days): Event
    {
        $date = CarbonImmutable::now(Event::timezone())->addDays($days)->format('Y-m-d');

        return Event::create([
            'title' => "Event {$days}",
            'category' => 'Meeting',
            'starts_at' => Event::combine($date, '10:00'),
            'ends_at' => Event::combine($date, '12:00'),
        ]);
    }

    /**
     * A two-hour event whose end sits this many minutes from now — negative for
     * one that has already finished.
     *
     * Built to the minute rather than to the day, because that is the grain the
     * status rules now work at: an event that ended this morning is a different
     * case from one that ends this afternoon, and both are "today".
     */
    private function eventEndingInMinutes(int $minutes): Event
    {
        $end = CarbonImmutable::now()->addMinutes($minutes);

        return Event::create([
            'title' => "Event ending in {$minutes}m",
            'category' => 'Meeting',
            'starts_at' => $end->subHours(2),
            'ends_at' => $end,
        ]);
    }

    public function test_timing_is_derived_from_the_date(): void
    {
        $this->assertSame('today', $this->eventInDays(0)->timing());
        $this->assertSame('upcoming', $this->eventInDays(1)->timing());
        $this->assertSame('past', $this->eventInDays(-1)->timing());
    }

    public function test_timing_reads_as_words(): void
    {
        $this->assertSame('Today', $this->eventInDays(0)->timingLabel());
        $this->assertSame('Tomorrow', $this->eventInDays(1)->timingLabel());
        $this->assertSame('Yesterday', $this->eventInDays(-1)->timingLabel());
        $this->assertSame('In 3 days', $this->eventInDays(3)->timingLabel());
        $this->assertSame('2 days ago', $this->eventInDays(-2)->timingLabel());
        // Coarsens once a day count stops reading as a length of time.
        $this->assertSame('In 3 weeks', $this->eventInDays(21)->timingLabel());
        $this->assertSame('4 weeks ago', $this->eventInDays(-28)->timingLabel());
        $this->assertSame('In 3 months', $this->eventInDays(95)->timingLabel());
    }

    public function test_an_event_starts_scheduled_and_the_secretary_can_close_it(): void
    {
        $event = $this->eventInDays(-1);
        $this->assertSame(EventStatus::Scheduled, $event->status);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('status', 'done')
            ->assertJsonPath('statusLabel', 'Done');

        $this->assertSame(EventStatus::Done, $event->fresh()->status);

        $this->assertDatabaseHas('activity_logs', ['action' => 'event_status_changed']);
    }

    /**
     * Status is an account of what happened, so it cannot be given before the
     * event is over — "Done" on next week's meeting would be a claim about the
     * future, and "Done" on one still running is a claim about the rest of it.
     */
    public function test_the_status_cannot_be_set_before_the_event_is_over(): void
    {
        $secretary = $this->acting(UserRole::Secretary);

        // Days away, and happening right now.
        foreach ([$this->eventInDays(2), $this->eventEndingInMinutes(30)] as $event) {
            $this->actingAs($secretary)
                ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
                ->assertJsonValidationErrors('status');

            $this->assertSame(EventStatus::Scheduled, $event->fresh()->status);
            $this->assertFalse($event->statusIsEditable());
        }

        // Once it is over and the hour has run out, it opens up.
        $over = $this->eventEndingInMinutes(-90);
        $this->assertTrue($over->statusIsEditable());
        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$over->id}/status", ['status' => 'cancelled'])
            ->assertOk();
    }

    /**
     * The hour after an event ends belongs to the event: people are still
     * packing up, and the officer who would close it off is one of them. Being
     * asked then is being asked too early to answer.
     *
     * The clock is pinned to an afternoon so the boundary is crossed without
     * the day changing — the whole point of the rule is that it no longer waits
     * for midnight.
     */
    public function test_the_status_opens_an_hour_after_the_event_ends(): void
    {
        $secretary = $this->acting(UserRole::Secretary);
        $timezone = Event::timezone();

        $event = Event::create([
            'title' => 'General Assembly',
            'category' => 'Meeting',
            'starts_at' => Event::combine('2026-11-03', '10:00'),
            'ends_at' => Event::combine('2026-11-03', '12:00'),
        ]);

        // Half an hour after it ended: still inside the grace period.
        $this->travelTo(CarbonImmutable::parse('2026-11-03 12:30', $timezone));
        $this->assertFalse($event->statusIsEditable());
        $this->assertFalse($event->needsStatusUpdate());
        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertJsonValidationErrors('status');

        // An hour and a half after: the same afternoon, and now askable.
        $this->travelTo(CarbonImmutable::parse('2026-11-03 13:30', $timezone));
        $this->assertTrue($event->statusIsEditable());
        $this->assertTrue($event->needsStatusUpdate());
        $this->assertSame('today', $event->timing());

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk()
            ->assertJsonPath('status', 'done')
            // Closed off on the day it happened, without the calendar having
            // had to wait for tomorrow to ask.
            ->assertJsonPath('timing', 'today');
    }

    /**
     * A row saved before end times were recorded has none to measure from, so
     * it is taken as an hour long — the calendar still has an answer for when
     * to start asking, rather than falling back to a second rule.
     */
    public function test_an_event_with_no_end_time_is_treated_as_an_hour_long(): void
    {
        $event = Event::create([
            'title' => 'Legacy meeting',
            'category' => 'Meeting',
            'starts_at' => Event::combine('2026-11-03', '10:00'),
        ]);

        $this->travelTo(CarbonImmutable::parse('2026-11-03 11:30', Event::timezone()));
        $this->assertFalse($event->statusIsEditable());

        // Assumed to end at 11:00, plus the hour.
        $this->travelTo(CarbonImmutable::parse('2026-11-03 12:30', Event::timezone()));
        $this->assertTrue($event->statusIsEditable());
    }

    public function test_no_other_role_can_change_an_events_status(): void
    {
        $event = $this->eventInDays(-1);

        foreach ([UserRole::ProgrammingTeam, UserRole::President, UserRole::Adviser] as $role) {
            $this->actingAs($this->acting($role))
                ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'cancelled'])
                ->assertForbidden();
        }

        $this->assertSame(EventStatus::Scheduled, $event->fresh()->status);
    }

    /* --------------------------------------------------- attendance window */

    /**
     * The QR and the code are good up to and including the event's day, and
     * dead afterwards — so a scan of last week's meeting cannot record
     * attendance for it.
     *
     * ⚠ Nothing calls this yet: there is no check-in endpoint to call it from.
     * The rule is asserted here so the endpoint, when it exists, has something
     * to break if it forgets.
     */
    public function test_attendance_is_accepted_only_up_to_the_day_of_the_event(): void
    {
        $this->assertTrue($this->eventInDays(2)->acceptsAttendance());
        $this->assertTrue($this->eventInDays(0)->acceptsAttendance());
        $this->assertFalse($this->eventInDays(-1)->acceptsAttendance());

        $cancelled = $this->eventInDays(-2);
        $cancelled->update(['status' => EventStatus::Cancelled]);
        $this->assertFalse($cancelled->fresh()->acceptsAttendance());
    }

    /** The API says so too, so the calendar never claims a dead code is live. */
    public function test_the_calendar_reports_when_attendance_has_expired(): void
    {
        $this->eventInDays(-1);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.acceptsAttendance', false)
            ->assertJsonPath('data.0.statusEditable', true);
    }

    /**
     * The whole reason status is not derived from the date: an event whose day
     * has gone by while still Scheduled is one nobody has accounted for, and
     * the calendar has to be able to say so.
     */
    public function test_a_past_event_still_scheduled_is_flagged_as_needing_an_update(): void
    {
        $this->assertTrue($this->eventInDays(-1)->needsStatusUpdate());
        $this->assertFalse($this->eventInDays(1)->needsStatusUpdate());
        // Under way right now: due, but not yet something to account for.
        $this->assertFalse($this->eventEndingInMinutes(30)->needsStatusUpdate());

        $closed = $this->eventInDays(-3);
        $closed->update(['status' => EventStatus::Done]);
        $this->assertFalse($closed->fresh()->needsStatusUpdate());
    }

    /* --------------------------------------------------------- share links */

    public function test_the_secretary_can_generate_a_share_link(): void
    {
        $event = $this->eventInDays(3);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson("/api/admin/events/{$event->id}/share")
            ->assertOk()
            ->assertJsonPath('canShare', true)
            ->assertJsonPath('shareUrl', fn (?string $url): bool => is_string($url) && str_contains($url, '/events/'));

        $this->assertNotNull($event->fresh()->share_token);
    }

    /** Asking twice hands back the same link rather than rotating it. */
    public function test_generating_a_share_link_twice_is_stable(): void
    {
        $event = $this->eventInDays(3);
        $secretary = $this->acting(UserRole::Secretary);

        $first = $this->actingAs($secretary)->postJson("/api/admin/events/{$event->id}/share")->json('shareUrl');
        $second = $this->actingAs($secretary)->postJson("/api/admin/events/{$event->id}/share")->json('shareUrl');

        $this->assertSame($first, $second);
    }

    /** Sharing is allowed right up to and including the day itself. */
    public function test_sharing_is_allowed_on_the_day_of_the_event(): void
    {
        $event = $this->eventInDays(0);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson("/api/admin/events/{$event->id}/share")
            ->assertOk();
    }

    public function test_a_closed_or_past_event_cannot_be_shared(): void
    {
        $secretary = $this->acting(UserRole::Secretary);

        $past = $this->eventInDays(-1);
        $this->actingAs($secretary)
            ->postJson("/api/admin/events/{$past->id}/share")
            ->assertJsonValidationErrors('status');

        foreach ([EventStatus::Done, EventStatus::Cancelled] as $status) {
            $closed = $this->eventInDays(2);
            $closed->update(['status' => $status]);

            $this->actingAs($secretary)
                ->postJson("/api/admin/events/{$closed->id}/share")
                ->assertJsonValidationErrors('status');

            $this->assertNull($closed->fresh()->share_token);
        }
    }

    /* -------------------------------------------------- the public page */

    public function test_a_shared_link_is_readable_without_signing_in(): void
    {
        $event = $this->eventInDays(1);
        $token = $event->ensureShareToken();

        $this->getJson("/api/events/shared/{$token}")
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('title', $event->title)
            ->assertJsonPath('attendanceCode', $event->attendance_code)
            ->assertJsonPath('timingLabel', 'Tomorrow')
            ->assertJsonStructure(['qrUrl', 'dateLabel', 'timeLabel', 'category']);
    }

    public function test_an_unknown_share_token_is_a_404(): void
    {
        $this->getJson('/api/events/shared/nope')->assertNotFound();
    }

    /**
     * The rules are re-checked on every request, not frozen at the moment the
     * link was made — so cancelling an event takes down a link already sent.
     */
    /** Move an event's day, standing in for time passing. */
    private function moveTo(Event $event, int $days): Event
    {
        $date = CarbonImmutable::now(Event::timezone())->addDays($days)->format('Y-m-d');

        $event->forceFill([
            'starts_at' => Event::combine($date, '10:00'),
            'ends_at' => Event::combine($date, '12:00'),
        ])->save();

        return $event->fresh();
    }

    public function test_closing_an_event_kills_a_link_already_shared(): void
    {
        $event = $this->eventInDays(0);
        $token = $event->ensureShareToken();

        $this->getJson("/api/events/shared/{$token}")->assertOk();

        // The day goes by: the link dies on the date alone, before anyone has
        // touched the status.
        $event = $this->moveTo($event, -1);
        $this->getJson("/api/events/shared/{$token}")
            ->assertStatus(410)
            ->assertJsonPath('reason', 'This event has already passed.');

        // And once the Secretary says what became of it, the reason sharpens.
        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('shareUrl', null);

        $this->getJson("/api/events/shared/{$token}")
            ->assertStatus(410)
            ->assertJsonPath('available', false)
            ->assertJsonPath('reason', 'This event was cancelled.');
    }

    /**
     * Revocation has to be permanent, or it is only a pause: reopening an event
     * would otherwise hand access back to everyone who was ever sent the link,
     * silently and without anyone deciding to.
     */
    public function test_reopening_an_event_does_not_revive_the_old_link(): void
    {
        $event = $this->eventInDays(0);
        $token = $event->ensureShareToken();
        $secretary = $this->acting(UserRole::Secretary);

        // It passes, is marked cancelled, and is then put back on the calendar
        // for a new date — the full round trip that would otherwise hand the
        // old link back to everyone who was ever sent it.
        $event = $this->moveTo($event, -1);

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}", $this->payload([
                'date' => CarbonImmutable::now(Event::timezone())->addDays(5)->format('Y-m-d'),
            ]))
            ->assertOk();

        // Retracting a status is allowed whatever the date — otherwise a
        // rescheduled event would stay closed for good.
        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'scheduled'])
            ->assertOk()
            ->assertJsonPath('canShare', true)
            ->assertJsonPath('shareUrl', null);

        $this->getJson("/api/events/shared/{$token}")->assertStatus(410);

        // Sharing again issues a different link, and the old one stays dead.
        $replacement = $this->actingAs($secretary)
            ->postJson("/api/admin/events/{$event->id}/share")
            ->assertOk()
            ->json('shareUrl');

        $this->assertIsString($replacement);
        $this->assertStringNotContainsString($token, $replacement);
        $this->getJson("/api/events/shared/{$token}")->assertNotFound();
    }

    /**
     * A withdrawn link still recognises itself for as long as it can, so the
     * holder is told what happened rather than left thinking they mistyped it.
     */
    public function test_a_revoked_link_explains_itself(): void
    {
        $event = $this->eventInDays(0);
        $token = $event->ensureShareToken();
        $event = $this->moveTo($event, -1);

        $this->actingAs($this->acting(UserRole::Secretary))
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk();

        $this->getJson("/api/events/shared/{$token}")
            ->assertStatus(410)
            ->assertJsonPath('title', $event->title)
            ->assertJsonPath('reason', 'This event has already taken place.');
    }

    /** The public payload carries what was meant to be shared, and no more. */
    public function test_the_public_page_does_not_leak_internal_fields(): void
    {
        $event = $this->eventInDays(1);
        $token = $event->ensureShareToken();

        $body = $this->getJson("/api/events/shared/{$token}")->assertOk()->json();

        foreach (['id', 'createdBy', 'shareUrl', 'share_token', 'startsAt'] as $field) {
            $this->assertArrayNotHasKey($field, $body);
        }
    }

    /* ---------------------------------------------------------- integration */

    public function test_scheduling_is_written_to_the_activity_log(): void
    {
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated();

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'event_created',
            'actor_role' => 'secretary',
        ]);
    }

    /**
     * Scheduling is grantable like every other ability, so the chapter can hand
     * it to a further officer from the Privileges panel without a code change —
     * the default is the secretariat, not the secretariat forever.
     */
    public function test_the_privileges_panel_can_grant_scheduling_to_another_role(): void
    {
        $this->actingAs($this->acting(UserRole::Adviser))
            ->postJson('/api/admin/events', $this->payload())
            ->assertForbidden();

        RolePermission::grant(UserRole::Adviser, [
            'members.view', 'members.edit', 'schedule.manage',
        ]);

        $this->actingAs($this->acting(UserRole::Adviser))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated();
    }

    /**
     * And it runs the other way: the Assistant Secretary holds the calendar by
     * default, not by fiat, so a chapter that wants scheduling back with the
     * Secretary alone can say so from the panel.
     */
    public function test_the_privileges_panel_can_take_scheduling_off_the_assistant_secretary(): void
    {
        RolePermission::grant(UserRole::AssistantSecretary, ['members.view', 'members.edit']);

        $this->actingAs($this->acting(UserRole::AssistantSecretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertForbidden();

        // The Secretary is untouched by the revocation.
        $this->actingAs($this->acting(UserRole::Secretary))
            ->postJson('/api/admin/events', $this->payload())
            ->assertCreated();
    }
}
