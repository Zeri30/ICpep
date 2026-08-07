<?php

namespace Tests\Feature;

use App\Enums\AttendanceMethod;
use App\Enums\AttendanceStatus;
use App\Enums\EventStatus;
use App\Enums\UserRole;
use App\Models\Event;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Attendance: officers checking themselves in, and the secretariat's roster.
 *
 * The two rules the module exists to hold are that anyone signed in may record
 * *themselves* — the QR names the event and the session names the person — and
 * that only the secretariat may see or change what it says about anybody else.
 * Most of what is checked here is one of those two.
 */
class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    private function officer(UserRole $role = UserRole::Bod): User
    {
        return User::factory()->role($role)->create();
    }

    /**
     * An event under way right now, so its credentials are live and its
     * attendance is not yet locked.
     *
     * Pinned to a fixed midday moment rather than the real clock: a run
     * that happens to start within an hour of midnight in Manila — which
     * happens, not hypothetically — would let a test's own `$this->travel()`
     * push "today" into tomorrow and flip Event::acceptsAttendance()'s
     * same-day rule out from under it. Noon has no such edge to trip over.
     * The date itself doesn't matter, only that it isn't "now".
     *
     * `->utc()` before it reaches `starts_at`/`ends_at` is not decoration:
     * the columns are stored in UTC (see Event::combine(), which does the
     * same), and an org-timezone CarbonImmutable handed straight to Eloquent
     * gets its wall-clock digits stored as if they already were UTC — an
     * 8-hour mislabel for Manila, not merely a display quirk.
     */
    private function liveEvent(): Event
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-03 12:00', Event::timezone()));
        $now = CarbonImmutable::now(Event::timezone());

        return Event::create([
            'title' => 'General Assembly',
            'category' => 'Meeting',
            'starts_at' => $now->subMinutes(30)->utc(),
            'ends_at' => $now->addHours(2)->utc(),
        ]);
    }

    /** An event whose day has gone by — its QR and code are dead. */
    private function pastEvent(): Event
    {
        $then = CarbonImmutable::now(Event::timezone())->subDays(9);

        return Event::create([
            'title' => 'Last Week Meeting',
            'category' => 'Meeting',
            'starts_at' => Event::combine($then->format('Y-m-d'), '09:00'),
            'ends_at' => Event::combine($then->format('Y-m-d'), '11:00'),
        ]);
    }

    /* ------------------------------------------------------------ checking in */

    public function test_a_signed_in_officer_scanning_the_qr_is_marked_present(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertOk()
            ->assertJsonPath('status', 'present')
            ->assertJsonPath('alreadyCheckedIn', false)
            ->assertJsonPath('event.title', 'General Assembly');

        $this->assertDatabaseHas('event_attendance', [
            'event_id' => $event->id,
            'user_id' => $officer->id,
            'status' => AttendanceStatus::Present->value,
            'method' => AttendanceMethod::Qr->value,
        ]);
    }

    /**
     * Checking in needs no ability beyond being an active officer. The
     * view-only roles are exactly the ones most likely to be sitting in the
     * room, so a permission check here would defeat the module.
     *
     * Excludes the Programming Team — see
     * test_the_programming_team_cannot_check_in() — which runs the system
     * rather than holding a seat on the org chart, and so is not tracked here
     * at all.
     */
    public function test_every_officer_role_can_check_itself_in(): void
    {
        $event = $this->liveEvent();
        $roles = array_filter(UserRole::cases(), fn (UserRole $r): bool => $r !== UserRole::ProgrammingTeam);

        foreach ($roles as $role) {
            $this->actingAs($this->officer($role))
                ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
                ->assertOk()
                ->assertJsonPath('status', 'present');
        }

        $this->assertSame(count($roles), $event->attendance()->count());
    }

    /**
     * The Programming Team's account runs the system, not a seat on the org
     * chart — it has no attendance to record, at any event, by any method.
     */
    public function test_the_programming_team_cannot_check_in(): void
    {
        $event = $this->liveEvent();

        $this->actingAs($this->officer(UserRole::ProgrammingTeam))
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertStatus(422)
            ->assertJsonValidationErrors('token');

        $this->assertSame(0, $event->attendance()->count());
    }

    /** Nobody signed in is nobody at all: there is no anonymous check-in. */
    public function test_a_signed_out_visitor_cannot_check_in(): void
    {
        $event = $this->liveEvent();

        $this->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertUnauthorized();

        $this->assertSame(0, $event->attendance()->count());
    }

    /** A deactivated account is turned away like any other admin request. */
    public function test_a_deactivated_officer_cannot_check_in(): void
    {
        $officer = User::factory()->role(UserRole::Bod)->create(['is_active' => false]);

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['token' => $this->liveEvent()->qr_token])
            ->assertForbidden();
    }

    /**
     * The most likely thing to happen in a room where the phone did not
     * obviously respond: scanning again. It must neither error nor duplicate,
     * and it must not restamp the time they actually arrived.
     */
    public function test_scanning_twice_neither_errors_nor_duplicates(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertOk();

        $first = $event->attendance()->sole();

        $this->travel(5)->minutes();

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertOk()
            ->assertJsonPath('alreadyCheckedIn', true)
            ->assertJsonPath('status', 'present');

        $this->assertSame(1, $event->attendance()->count());
        $this->assertEquals(
            $first->checked_in_at->timestamp,
            $event->attendance()->sole()->checked_in_at->timestamp,
            'A second scan must keep the time they actually arrived.',
        );
    }

    /* --------------------------------------------------------- the short code */

    public function test_the_attendance_code_works_and_records_how_it_was_used(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['code' => $event->attendance_code])
            ->assertOk()
            ->assertJsonPath('status', 'present');

        $this->assertDatabaseHas('event_attendance', [
            'event_id' => $event->id,
            'user_id' => $officer->id,
            'method' => AttendanceMethod::Code->value,
        ]);
    }

    /**
     * The code is read aloud in a room and typed on a phone keyboard that will
     * offer lowercase. No character in the alphabet carries meaning by case, so
     * accepting either can never turn one valid code into a different one.
     */
    public function test_the_code_is_accepted_in_lowercase(): void
    {
        $event = $this->liveEvent();

        $this->actingAs($this->officer())
            ->postJson('/api/admin/check-in', ['code' => strtolower($event->attendance_code)])
            ->assertOk()
            ->assertJsonPath('status', 'present');
    }

    public function test_a_wrong_code_is_refused_without_recording_anything(): void
    {
        $event = $this->liveEvent();

        $this->actingAs($this->officer())
            ->postJson('/api/admin/check-in', ['code' => 'ZZZZZZ'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        $this->assertSame(0, $event->attendance()->count());
    }

    /**
     * A six-character code with unlimited guesses is not a control. Only wrong
     * answers are counted — an officer checking into several events in a row is
     * doing nothing that should be slowed down.
     */
    public function test_repeated_wrong_codes_are_rate_limited(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();

        for ($attempt = 0; $attempt < 10; $attempt++) {
            $this->actingAs($officer)
                ->postJson('/api/admin/check-in', ['code' => 'ZZZZZZ'])
                ->assertStatus(422);
        }

        $throttled = $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['code' => 'ZZZZZZ'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('code');

        // The wording, not the number of seconds left in it — that ticks down
        // while the test runs and asserting on it makes the test fail for
        // reasons that have nothing to do with the throttle working.
        $this->assertStringStartsWith(
            'Too many incorrect codes.',
            $throttled->json('errors.code.0'),
        );

        // And the throttle holds even once they produce the right code, which
        // is the whole point of it.
        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['code' => $event->attendance_code])
            ->assertStatus(422);

        RateLimiter::clear('attendance-code|'.$officer->id.'|127.0.0.1');
    }

    public function test_a_correct_code_does_not_count_against_the_limit(): void
    {
        $officer = $this->officer();

        for ($attempt = 0; $attempt < 12; $attempt++) {
            $event = $this->liveEvent();
            $event->forceFill(['title' => "Meeting {$attempt}"])->save();

            $this->actingAs($officer)
                ->postJson('/api/admin/check-in', ['code' => $event->attendance_code])
                ->assertOk();
        }
    }

    /* --------------------------------------------------------------- expiry */

    /**
     * `Event::acceptsAttendance()` has existed since the scheduler shipped with
     * nothing calling it. This is the endpoint it was written for.
     */
    public function test_the_qr_stops_working_once_the_event_has_passed(): void
    {
        $event = $this->pastEvent();

        $this->actingAs($this->officer())
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertStatus(422)
            ->assertJsonFragment(['token' => ['This event has already passed.']]);

        $this->assertSame(0, $event->attendance()->count());
    }

    public function test_the_code_stops_working_once_the_event_is_closed(): void
    {
        $event = $this->liveEvent();
        $event->update(['status' => EventStatus::Done]);

        $this->actingAs($this->officer())
            ->postJson('/api/admin/check-in', ['code' => $event->attendance_code])
            ->assertStatus(422)
            ->assertJsonFragment(['token' => ['This event has already taken place.']]);
    }

    public function test_a_cancelled_event_takes_no_attendance(): void
    {
        $event = $this->liveEvent();
        $event->update(['status' => EventStatus::Cancelled]);

        $this->actingAs($this->officer())
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertStatus(422)
            ->assertJsonFragment(['token' => ['This event was cancelled.']]);
    }

    /* ---------------------------------------------------- the check-in page */

    /**
     * What the page asks for before it records anything. An officer holding
     * last week's QR is told the event has passed rather than that their link
     * is broken — the difference decides whether they go looking for the
     * Secretary.
     */
    public function test_the_page_reports_a_passed_event_rather_than_an_invalid_one(): void
    {
        $event = $this->pastEvent();

        $this->actingAs($this->officer())
            ->getJson("/api/admin/check-in?token={$event->qr_token}")
            ->assertOk()
            ->assertJsonPath('accepted', false)
            ->assertJsonPath('closedReason', 'This event has already passed.')
            ->assertJsonPath('status', 'pending');
    }

    public function test_an_unrecognised_token_is_a_404(): void
    {
        $this->actingAs($this->officer())
            ->getJson('/api/admin/check-in?token=nothing-like-a-real-token')
            ->assertNotFound();
    }

    public function test_the_page_reports_a_check_in_already_recorded(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();
        $event->checkIn($officer, AttendanceMethod::Qr);

        $this->actingAs($officer)
            ->getJson("/api/admin/check-in?token={$event->qr_token}")
            ->assertOk()
            ->assertJsonPath('accepted', true)
            ->assertJsonPath('status', 'present');
    }

    /* --------------------------------------------------------------- roster */

    public function test_the_roster_lists_every_active_officer_with_their_status(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $present = $this->officer(UserRole::Pro);
        $missing = $this->officer(UserRole::Treasurer);

        $event = $this->liveEvent();
        $event->checkIn($present, AttendanceMethod::Qr);

        $response = $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$event->id}/attendance")
            ->assertOk()
            // The secretary, the one who checked in, and the one who did not.
            ->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.present', 1)
            ->assertJsonPath('summary.pending', 2)
            ->assertJsonPath('summary.absent', 0);

        $rows = collect($response->json('data'))->keyBy('userId');

        $this->assertSame('present', $rows[$present->id]['status']);
        $this->assertSame('QR scan', $rows[$present->id]['methodLabel']);
        $this->assertSame('pending', $rows[$missing->id]['status']);
        $this->assertSame('Not checked in', $rows[$missing->id]['statusLabel']);
    }

    /** Deactivated accounts are not on the board and are not on the roster. */
    public function test_the_roster_leaves_out_deactivated_accounts(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        User::factory()->role(UserRole::Pro)->create(['is_active' => false]);

        $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$this->liveEvent()->id}/attendance")
            ->assertOk()
            ->assertJsonPath('summary.total', 1);
    }

    /**
     * The roster says who missed which meeting. That is the organization's
     * record rather than everybody's business, and it is held to the same
     * ability that already withholds the QR token it is built from.
     */
    public function test_a_role_without_schedule_manage_cannot_read_the_roster(): void
    {
        foreach ([UserRole::Pro, UserRole::Treasurer, UserRole::President] as $role) {
            $this->actingAs($this->officer($role))
                ->getJson("/api/admin/events/{$this->liveEvent()->id}/attendance")
                ->assertForbidden();
        }
    }

    /** The Assistant Secretary runs the roster on exactly the same terms. */
    public function test_the_assistant_secretary_can_read_and_correct_the_roster(): void
    {
        $assistant = $this->officer(UserRole::AssistantSecretary);
        $officer = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();

        $this->actingAs($assistant)
            ->getJson("/api/admin/events/{$event->id}/attendance")
            ->assertOk();

        $this->actingAs($assistant)
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'present',
            ])
            ->assertOk();

        $this->assertDatabaseHas('event_attendance', [
            'event_id' => $event->id,
            'user_id' => $officer->id,
            'status' => AttendanceStatus::Present->value,
            'method' => AttendanceMethod::Override->value,
            'recorded_by' => $assistant->id,
        ]);
    }

    /* ------------------------------------------------------- automatic lock */

    /**
     * `Event::attendanceLocked()` is a plain fact about the clock — the roster
     * reports it so the panel never has to re-derive it from a browser clock
     * that might disagree with the server's.
     */
    public function test_the_roster_reports_whether_attendance_is_locked(): void
    {
        $secretary = $this->officer(UserRole::Secretary);

        $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$this->liveEvent()->id}/attendance")
            ->assertOk()
            ->assertJsonPath('attendanceLocked', false)
            ->assertJsonPath('attendanceLockedReason', null);

        $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$this->pastEvent()->id}/attendance")
            ->assertOk()
            ->assertJsonPath('attendanceLocked', true)
            ->assertJsonPath(
                'attendanceLockedReason',
                fn (string $reason) => str_starts_with($reason, 'This event ended at'),
            );
    }

    /**
     * Nobody has to mark the event Done for this to happen, and nobody has to
     * open the roster again after it does — the next time anyone does, the
     * gap has already been closed.
     */
    public function test_attendance_is_automatically_recorded_absent_once_the_event_ends(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $present = $this->officer(UserRole::Pro);
        $this->officer(UserRole::Treasurer);

        $event = $this->pastEvent();
        $event->checkIn($present, AttendanceMethod::Qr);

        $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$event->id}/attendance")
            ->assertOk()
            // The one who checked in, and the secretary plus the officer who
            // never did — the reader of the roster is an active officer too.
            ->assertJsonPath('summary.present', 1)
            ->assertJsonPath('summary.absent', 2)
            ->assertJsonPath('summary.pending', 0);

        // Nobody closed it — the event is still sitting there Scheduled.
        $this->assertSame(EventStatus::Scheduled, $event->fresh()->status);
    }

    /** Nothing took place, so nobody missed it — the same rule a manual Done applies. */
    public function test_a_cancelled_event_gets_no_automatic_absences_once_it_ends(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $this->officer(UserRole::Pro);

        $event = $this->pastEvent();
        $event->update(['status' => EventStatus::Cancelled]);

        $this->actingAs($secretary)
            ->getJson("/api/admin/events/{$event->id}/attendance")
            ->assertOk()
            ->assertJsonPath('summary.absent', 0);

        $this->assertSame(0, $event->attendance()->count());
    }

    /* --------------------------------------------------- your own attendance */

    /**
     * Every role sees its own line on every event, including the roles that get
     * no roster. Your own attendance is yours; who *else* was there is the
     * secretariat's.
     */
    public function test_every_role_sees_its_own_attendance_on_the_calendar(): void
    {
        $event = $this->liveEvent();

        foreach ([UserRole::Pro, UserRole::Treasurer, UserRole::Bod] as $role) {
            $officer = $this->officer($role);
            $event->checkIn($officer, AttendanceMethod::Qr);

            $this->actingAs($officer)
                ->getJson('/api/admin/events')
                ->assertOk()
                ->assertJsonPath('data.0.myAttendance.status', 'present')
                ->assertJsonPath('data.0.myAttendance.statusLabel', 'Present')
                ->assertJsonPath('data.0.myAttendance.methodLabel', 'QR scan')
                // Already on the record, so there is nothing left to offer them.
                ->assertJsonPath('data.0.myAttendance.canCheckIn', false);
        }
    }

    /** One officer's line never leaks another's. */
    public function test_your_attendance_is_your_own_and_not_somebody_elses(): void
    {
        $present = $this->officer(UserRole::Pro);
        $watcher = $this->officer(UserRole::Treasurer);

        $event = $this->liveEvent();
        $event->checkIn($present, AttendanceMethod::Qr);

        $this->actingAs($watcher)
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.myAttendance.status', 'pending')
            ->assertJsonPath('data.0.myAttendance.statusLabel', 'Not checked in')
            // The codes are live and they are not on the record — the one case
            // where offering a way in is worth doing.
            ->assertJsonPath('data.0.myAttendance.canCheckIn', true)
            // And nothing about the officer who did check in.
            ->assertJsonMissing(['name' => $present->name]);
    }

    /**
     * An expired event offers nobody a way in, recorded or not — and reads
     * the same as the roster would the moment anyone opens it: absent, not
     * a lingering "not checked in" nobody can act on. See
     * EventResource::myAttendance() and Event::attendanceLocked().
     */
    public function test_a_passed_event_offers_no_way_to_check_in(): void
    {
        $this->pastEvent();

        $this->actingAs($this->officer(UserRole::Pro))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.myAttendance.status', 'absent')
            ->assertJsonPath('data.0.myAttendance.canCheckIn', false);
    }

    /**
     * The case worth testing on its own: same day, so the codes are still
     * live by Event::acceptsAttendance()'s looser same-day rule, but the
     * event's own end time has already passed. The panel offers no way back
     * in even though a QR printed for it would still scan — see
     * Event::attendanceLocked() and EventResource::myAttendance().
     *
     * Pinned to a fixed midday moment — see liveEvent()'s docblock. A run
     * starting within 3 hours of midnight in Manila would otherwise roll
     * `starts_at` into the previous day and fail the same-day sanity check
     * below, which is exactly the flake this test used to have.
     */
    public function test_myattendance_locks_out_even_on_the_same_day_once_the_event_has_ended(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-03 12:00', Event::timezone()));
        $now = CarbonImmutable::now(Event::timezone());

        $event = Event::create([
            'title' => 'Morning Meeting',
            'category' => 'Meeting',
            'starts_at' => $now->subHours(3)->utc(),
            'ends_at' => $now->subHours(1)->utc(),
        ]);

        $this->assertTrue($event->acceptsAttendance(), 'Sanity: still the same day.');
        $this->assertTrue($event->attendanceLocked(), 'Sanity: its own end time has passed.');

        $this->actingAs($this->officer(UserRole::Pro))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.myAttendance.status', 'absent')
            ->assertJsonPath('data.0.myAttendance.canCheckIn', false);
    }

    /** Nothing took place, so nobody missed it — even once its day has gone by. */
    public function test_myattendance_stays_pending_for_a_cancelled_event(): void
    {
        $event = $this->pastEvent();
        $event->update(['status' => EventStatus::Cancelled]);

        $this->actingAs($this->officer(UserRole::Pro))
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.myAttendance.status', 'pending');
    }

    /** Being closed off as absent is exactly what an officer needs to see. */
    public function test_an_officer_sees_the_absence_recorded_against_them(): void
    {
        $officer = $this->officer(UserRole::Pro);
        $event = $this->pastEvent();
        $event->recordAbsentees();

        $this->actingAs($officer)
            ->getJson('/api/admin/events')
            ->assertOk()
            ->assertJsonPath('data.0.myAttendance.status', 'absent')
            ->assertJsonPath('data.0.myAttendance.statusLabel', 'Absent');
    }

    /**
     * The calendar sends every officer their own line without a query per
     * event — the relation is eager-loaded, constrained to whoever is asking.
     */
    public function test_the_calendar_does_not_query_attendance_per_event(): void
    {
        $officer = $this->officer(UserRole::Pro);

        for ($i = 0; $i < 5; $i++) {
            $this->liveEvent()->checkIn($officer, AttendanceMethod::Qr);
        }

        $queries = 0;
        DB::listen(function () use (&$queries): void {
            $queries++;
        });

        $this->actingAs($officer)->getJson('/api/admin/events')->assertOk();

        // Events, creators, attendance, and the session/permission reads around
        // them — a handful, and crucially not one per event.
        $this->assertLessThan(10, $queries, "Expected a constant number of queries, got {$queries}.");
    }

    /* ------------------------------------------------------------ correcting */

    /**
     * Dead phones and late arrivals are the normal case, not the exception. A
     * roster that cannot be corrected is one that gets abandoned for a sheet of
     * paper.
     */
    public function test_the_secretary_can_mark_someone_present_by_hand_and_it_is_logged(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $officer = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'present',
            ])
            ->assertOk()
            ->assertJsonPath('summary.present', 1);

        $record = $event->attendance()->sole();
        $this->assertSame(AttendanceMethod::Override, $record->method);
        $this->assertSame($secretary->id, $record->recorded_by);
        $this->assertNotNull($record->checked_in_at);

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'attendance_overridden',
            'description' => "Marked {$officer->name} Present for {$event->title} (was Not checked in)",
        ]);
    }

    /** Marking someone absent drops any check-in time, which would contradict it. */
    public function test_marking_someone_absent_clears_the_check_in_time(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $officer = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();
        $event->checkIn($officer, AttendanceMethod::Qr);

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'absent',
            ])
            ->assertOk();

        $record = $event->attendance()->sole();
        $this->assertSame(AttendanceStatus::Absent, $record->status);
        $this->assertNull($record->checked_in_at);
    }

    /**
     * Withdrawing a status is a correction too. Without it, a status set on the
     * wrong person could be flipped but never taken back.
     */
    public function test_a_status_can_be_withdrawn_back_to_unaccounted_for(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $officer = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();
        $event->checkIn($officer, AttendanceMethod::Qr);

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'pending',
            ])
            ->assertOk()
            ->assertJsonPath('summary.present', 0)
            ->assertJsonPath('summary.pending', 2);

        $this->assertSame(0, $event->attendance()->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'attendance_cleared']);
    }

    /**
     * The secretariat's ability to correct the roster by hand ends with the
     * event itself — see Event::attendanceLocked(). Checked ahead of the
     * permission the rest of this section exercises, so a stale button after
     * the event has ended is told why, rather than reaching a generic error.
     */
    public function test_the_secretary_cannot_correct_attendance_once_the_event_has_ended(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $officer = $this->officer(UserRole::Pro);
        $event = $this->pastEvent();

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'present',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');

        $this->assertSame(0, $event->attendance()->count());
    }

    public function test_a_role_without_schedule_manage_cannot_correct_the_roster(): void
    {
        $officer = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();

        $this->actingAs($this->officer(UserRole::Treasurer))
            ->patchJson("/api/admin/events/{$event->id}/attendance/{$officer->id}", [
                'status' => 'present',
            ])
            ->assertForbidden();

        $this->assertSame(0, $event->attendance()->count());
    }

    /**
     * Reading the roster is not permission to change it, and holding
     * schedule.manage is not permission to check in on somebody else's behalf
     * through the check-in endpoint — that one only ever records the caller.
     */
    public function test_the_check_in_endpoint_only_ever_records_the_caller(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $other = $this->officer(UserRole::Pro);
        $event = $this->liveEvent();

        $this->actingAs($secretary)
            ->postJson('/api/admin/check-in', [
                'token' => $event->qr_token,
                // Not a field the endpoint accepts. Sent to prove it is ignored
                // rather than quietly honoured.
                'userId' => $other->id,
            ])
            ->assertOk();

        $this->assertSame($secretary->id, $event->attendance()->sole()->user_id);
    }

    /* --------------------------------------------------- closing the event */

    /**
     * The moment "nobody has said" stops being an honest reading of a missing
     * row.
     */
    public function test_closing_an_event_records_everyone_else_absent(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $present = $this->officer(UserRole::Pro);
        $this->officer(UserRole::Treasurer);

        $event = $this->pastEvent();
        $event->checkIn($present, AttendanceMethod::Qr);

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk();

        $this->assertSame(3, $event->attendance()->count());
        $this->assertSame(
            AttendanceStatus::Present,
            $event->attendance()->where('user_id', $present->id)->sole()->status,
        );
        $this->assertSame(2, $event->attendance()->where('status', AttendanceStatus::Absent)->count());

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'attendance_closed',
            'description' => "Recorded 2 officers absent from {$event->title}",
        ]);
    }

    /** Nothing took place, so nobody missed it. */
    public function test_cancelling_an_event_records_nobody_absent(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $this->officer(UserRole::Pro);
        $event = $this->pastEvent();

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->assertSame(0, $event->attendance()->count());
    }

    /**
     * Reopening withdraws the absences nobody chose and leaves every decision
     * alone — a check-in, and a status the secretariat set by hand.
     */
    public function test_reopening_an_event_withdraws_only_the_absences_nobody_chose(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $present = $this->officer(UserRole::Pro);
        $excused = $this->officer(UserRole::Treasurer);
        $this->officer(UserRole::Adviser);

        $event = $this->pastEvent();
        $event->checkIn($present, AttendanceMethod::Qr);
        $event->setAttendance($excused, AttendanceStatus::Absent, $secretary);

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk();

        $this->assertSame(4, $event->attendance()->count());

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'scheduled'])
            ->assertOk();

        $remaining = $event->attendance()->get()->keyBy('user_id');

        $this->assertCount(2, $remaining);
        $this->assertTrue($remaining->has($present->id), 'A check-in is a decision and must stand.');
        $this->assertTrue($remaining->has($excused->id), 'A hand-set absence is a decision and must stand.');
    }

    /** Correcting Done to Cancelled means it never happened, absences and all. */
    public function test_correcting_done_to_cancelled_withdraws_the_absences(): void
    {
        $secretary = $this->officer(UserRole::Secretary);
        $this->officer(UserRole::Pro);
        $event = $this->pastEvent();

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'done'])
            ->assertOk();
        $this->assertSame(2, $event->attendance()->count());

        $this->actingAs($secretary)
            ->patchJson("/api/admin/events/{$event->id}/status", ['status' => 'cancelled'])
            ->assertOk();

        $this->assertSame(0, $event->attendance()->count());
    }

    /**
     * An officer closed off as absent who turns up late is flipped to present
     * with the time they actually scanned — the whole reason the record stays
     * correctable rather than final.
     */
    public function test_a_late_arrival_overwrites_an_absence(): void
    {
        $officer = $this->officer();
        $event = $this->liveEvent();

        $event->recordAbsentees();
        $this->assertSame(AttendanceStatus::Absent, $event->attendance()->sole()->status);

        $this->actingAs($officer)
            ->postJson('/api/admin/check-in', ['token' => $event->qr_token])
            ->assertOk()
            ->assertJsonPath('alreadyCheckedIn', false);

        $record = $event->attendance()->sole();
        $this->assertSame(AttendanceStatus::Present, $record->status);
        $this->assertNotNull($record->checked_in_at);
    }
}
