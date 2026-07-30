<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AttendanceMethod;
use App\Enums\AttendanceStatus;
use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\EventAttendanceResource;
use App\Models\ActivityLog;
use App\Models\Event;
use App\Models\EventAttendance;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Taking attendance at an event.
 *
 * ## Who this is for
 *
 * Officers, and only officers. Members have no accounts and never check in —
 * the QR encodes the *event's* token and carries nothing about a person, so
 * "who is checking in" is answered entirely by the session doing it. That is why
 * every route here sits behind EnsureAdmin and there is no public check-in page
 * anywhere in the system.
 *
 * ## The two halves
 *
 * Checking *yourself* in needs no ability beyond being a signed-in, active
 * officer: the whole point is that anyone holding a phone in the room can do it
 * without the Secretary touching anything.
 *
 * Reading the roster and correcting it needs `schedule.manage` — the
 * secretariat's. The roster says who missed which meeting, which is the
 * organization's record rather than everybody's business, and it is held to the
 * same permission that already governs the credentials it is built from (see
 * EventResource, which withholds the QR token from every other role).
 */
class AttendanceController extends Controller
{
    /**
     * How many wrong codes an officer may type before being made to wait.
     *
     * Six characters over a 31-character alphabet is around 900 million
     * combinations, so this is not what stands between a guesser and a code —
     * the length is. It is here because a short code with unlimited attempts is
     * not a control at all, and because a script hammering this endpoint is
     * worth stopping on its own merits.
     *
     * Counted per officer per address, and only wrong answers are counted: an
     * officer checking into three events in a row is not doing anything that
     * should be slowed down.
     */
    private const CODE_ATTEMPTS = 10;

    private const CODE_DECAY_SECONDS = 300;

    /**
     * What the check-in page shows before anything is recorded: which event this
     * token belongs to, and where the signed-in officer already stands with it.
     *
     * Answers 404 for a token that matches nothing, and 200 with
     * `accepted: false` for one whose event has closed or passed — an officer
     * holding a QR from last week's meeting is better told that the meeting has
     * passed than that their code is unrecognised.
     */
    public function show(Request $request): JsonResponse
    {
        $token = (string) $request->query('token', '');

        $event = $token === '' ? null : Event::byQrToken($token);

        if (! $event) {
            return response()->json([
                'message' => 'This check-in link is not valid. Ask the Secretary for the code instead.',
            ], 404);
        }

        return response()->json($this->state($event, $request->user()));
    }

    /**
     * Record the signed-in officer as present.
     *
     * Takes either the QR's token or the six-character code — one or the other,
     * never both — because they are two ways to say the same thing and the
     * record notes which was used.
     *
     * Safe to call twice. Scanning again is the most likely thing to happen when
     * a phone does not visibly respond the first time, so a second call returns
     * the same record, unchanged, with `alreadyCheckedIn` set — the page can
     * then say "you were already checked in at 7:02 PM" rather than pretending
     * something just happened.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required_without:code', 'nullable', 'string'],
            'code' => ['required_without:token', 'nullable', 'string'],
        ], [
            'token.required_without' => 'Scan the QR code or enter the attendance code.',
            'code.required_without' => 'Enter the attendance code.',
        ]);

        $officer = $request->user();

        [$event, $method] = isset($data['token']) && $data['token'] !== ''
            ? [Event::byQrToken($data['token']), AttendanceMethod::Qr]
            : [$this->eventFromCode($request, (string) $data['code']), AttendanceMethod::Code];

        if (! $event) {
            // Only reachable by the QR path; the code path throws its own
            // message above so it can spend a rate-limit attempt first.
            throw ValidationException::withMessages([
                'token' => 'This check-in link is not valid. Ask the Secretary for the code instead.',
            ]);
        }

        // The rule lives on the model and is checked here because this is the
        // only thing that turns a credential into a record. A QR photographed
        // last week still scans — what stops it is this.
        if (! $event->acceptsAttendance()) {
            throw ValidationException::withMessages([
                'token' => $event->attendanceClosedReason() ?? 'This event is no longer taking attendance.',
            ]);
        }

        $existing = $event->attendance()->where('user_id', $officer->id)->first();
        $already = (bool) $existing?->isPresent();

        $record = $event->checkIn($officer, $method);

        // Logged once per officer per event. A second scan records nothing, so
        // it writes nothing — an activity log with four identical lines for one
        // person standing in one room is noise that hides the entries that
        // matter.
        if (! $already) {
            ActivityLog::record(
                'attendance_checked_in',
                "Checked in to {$event->title} by {$method->label()}",
            );
        }

        return response()->json([
            ...$this->state($event->fresh(), $officer),
            'alreadyCheckedIn' => $already,
            'checkedInLabel' => $record->checkedInLabel(),
        ]);
    }

    /**
     * The roster: every active officer against this event, checked in or not.
     *
     * Built from the officer list rather than from the attendance rows, because
     * the question it answers is "who is missing" — and the people who are
     * missing have no row to be built from. Polled by the modal while it is
     * open, so it stays cheap: two queries and no pagination, over a board of
     * a dozen or so accounts.
     */
    public function index(Event $event): JsonResponse
    {
        Gate::authorize('schedule.manage');

        // The event's own end time closes the roster on its own, whether or
        // not anyone has marked it Done — see Event::attendanceLocked(). A
        // cancelled event is left alone: nothing took place, so nobody missed
        // it, the same rule EventController::status() applies when Done is
        // set by hand.
        if ($event->attendanceLocked() && $event->status !== EventStatus::Cancelled) {
            $event->recordAbsentees();
        }

        $officers = User::query()
            ->where('is_active', true)
            ->with([
                'attendance' => fn ($query) => $query->where('event_id', $event->id)->with('recorder'),
            ])
            // Surname first, so the roster reads like a class list rather than
            // in whatever order the accounts happen to have been created.
            ->orderBy('last_name')
            ->orderBy('name')
            ->get();

        $rows = EventAttendanceResource::collection($officers)->resolve();

        return response()->json([
            'data' => $rows,
            'summary' => [
                'present' => $this->countOf($rows, 'present'),
                'absent' => $this->countOf($rows, 'absent'),
                'pending' => $this->countOf($rows, 'pending'),
                'total' => count($rows),
            ],
            // The facts the roster's own controls turn on: whether the QR and
            // code are still live, whether the event has been closed off, and
            // whether its own end time has passed and the roster is therefore
            // no longer correctable at all. Sent so the panel never re-derives
            // any of them from a browser clock that may disagree with the
            // server's.
            'acceptsAttendance' => $event->acceptsAttendance(),
            'closedReason' => $event->attendanceClosedReason(),
            'attendanceLocked' => $event->attendanceLocked(),
            'attendanceLockedReason' => $event->attendanceLockedReason(),
        ]);
    }

    /**
     * Correct one officer's status by hand.
     *
     * `pending` is a real choice here and not a no-op: it withdraws the record
     * entirely, putting the officer back to unaccounted-for. Without it a status
     * set on the wrong person could be flipped but never taken back, and the
     * roster would carry a decision nobody stands behind.
     *
     * Every change is logged, naming both officers — this is one officer
     * recording something about another, which is exactly the kind of change the
     * activity log exists for.
     */
    public function update(Request $request, Event $event, User $user): JsonResponse
    {
        Gate::authorize('schedule.manage');

        // Once the event's own end time has passed, the roster closes on its
        // own — see Event::attendanceLocked(). Checked ahead of validation so
        // a stale button reports why nothing happened rather than a generic
        // failure.
        if ($event->attendanceLocked()) {
            throw ValidationException::withMessages([
                'status' => $event->attendanceLockedReason(),
            ]);
        }

        $data = $request->validate([
            'status' => ['required', Rule::in([...AttendanceStatus::values(), 'pending'])],
        ], [
            'status.in' => 'That is not a status attendance can be set to.',
        ]);

        $actor = Auth::user();
        $before = $event->attendance()->where('user_id', $user->id)->first();

        if ($data['status'] === 'pending') {
            $before?->delete();
            $wasLabel = $before?->status->label() ?? 'Not checked in';

            ActivityLog::record(
                'attendance_cleared',
                "Cleared {$user->name}'s attendance for {$event->title} (was {$wasLabel})",
            );
        } else {
            $status = AttendanceStatus::from($data['status']);

            // Nothing to record when the roster already says this. Saving anyway
            // would write a log line about a change nobody made — and worse,
            // restamp a QR check-in as an override, losing the fact that the
            // officer scanned it themselves. Correcting a status that is already
            // right is not a correction; withdrawing it and setting it again is
            // still there for anyone who genuinely means to.
            if ($before?->status === $status) {
                return $this->index($event);
            }

            $event->setAttendance($user, $status, $actor);

            $wasLabel = $before?->status->label() ?? 'Not checked in';

            ActivityLog::record(
                'attendance_overridden',
                "Marked {$user->name} {$status->label()} for {$event->title} (was {$wasLabel})",
            );
        }

        return $this->index($event);
    }

    /**
     * Which event a typed code belongs to, spending a rate-limit attempt on a
     * wrong answer.
     *
     * The throttle is checked before the lookup and cleared on success, so a
     * legitimate officer who fat-fingers one character is never held up.
     */
    private function eventFromCode(Request $request, string $code): Event
    {
        $key = 'attendance-code|'.$request->user()->id.'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, self::CODE_ATTEMPTS)) {
            throw ValidationException::withMessages([
                'code' => 'Too many incorrect codes. Try again in '
                    .RateLimiter::availableIn($key).' seconds.',
            ]);
        }

        $event = Event::byAttendanceCode($code);

        if (! $event) {
            RateLimiter::hit($key, self::CODE_DECAY_SECONDS);

            throw ValidationException::withMessages([
                'code' => 'That code does not match any event. Check it with whoever read it out.',
            ]);
        }

        RateLimiter::clear($key);

        return $event;
    }

    /**
     * What the check-in page needs to render: the event, and this officer's own
     * standing with it.
     *
     * Deliberately thin. The officer scanning is not the secretariat and has no
     * business receiving the roster, the QR token or the code — they are holding
     * the credential already, and the rest is not theirs.
     *
     * @return array<string, mixed>
     */
    private function state(Event $event, User $officer): array
    {
        /** @var EventAttendance|null $record */
        $record = $event->attendance()->where('user_id', $officer->id)->first();

        return [
            'event' => [
                'id' => $event->id,
                'title' => $event->title,
                'category' => $event->category,
                'venue' => $event->venue,
                'dateLabel' => $event->starts_at->setTimezone(Event::timezone())->format('l, j F Y'),
                'timeRangeLabel' => $event->displayTimeRange(),
                'timingLabel' => $event->timingLabel(),
            ],
            // Whether a check-in would be accepted right now, and why not when
            // it would not. The page shows the reason instead of a form.
            'accepted' => $event->acceptsAttendance(),
            'closedReason' => $event->attendanceClosedReason(),
            'status' => $record?->status->value ?? 'pending',
            'checkedInLabel' => $record?->checkedInLabel(),
        ];
    }

    /** @param  list<array<string, mixed>>  $rows */
    private function countOf(array $rows, string $status): int
    {
        return count(array_filter($rows, fn (array $row): bool => $row['status'] === $status));
    }
}
