<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\EventStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\EventResource;
use App\Models\ActivityLog;
use App\Models\Event;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The organization's calendar of scheduled events.
 *
 * Reading is open to every officer — the calendar is the point, and a schedule
 * only some of the officers can see is not one. Writing belongs to whoever
 * holds `schedule.manage`, which by default is the Secretary alone.
 *
 * The write routes are gated by middleware as well as here; the check is
 * repeated in the controller so the authorization is visible at the action it
 * protects, matching the other modules.
 */
class EventController extends Controller
{
    /**
     * Every scheduled event, soonest first.
     *
     * Deliberately unpaginated: the calendar grid and the list beside it both
     * render the whole schedule, and a chapter books tens of events in a year,
     * not thousands. If that ever stops being true, a date window belongs here
     * rather than a page number — the grid asks for a month, not a page.
     */
    public function index(): AnonymousResourceCollection
    {
        return EventResource::collection(
            Event::with('creator')->chronological()->get(),
        );
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('schedule.manage');

        $data = $this->validated($request);

        $event = Event::create([
            'title' => $data['title'],
            'category' => $data['category'],
            'starts_at' => Event::combine($data['date'], $data['time']),
            'ends_at' => Event::combine($data['date'], $data['endTime']),
            'description' => $data['description'] ?? null,
            'created_by' => Auth::id(),
        ]);

        ActivityLog::record(
            'event_created',
            "Scheduled {$event->title} for {$event->localDate()} at {$event->displayTime()}",
        );

        return response()->json(new EventResource($event->load('creator')), 201);
    }

    /**
     * Answered with response()->json rather than by returning the resource, so
     * the edited event comes back in the same shape as a created one — a bare
     * object. Returning the resource itself would wrap it in `data` and give
     * the two endpoints different envelopes for the same thing.
     */
    public function update(Request $request, Event $event): JsonResponse
    {
        Gate::authorize('schedule.manage');

        $data = $this->validated($request);

        // Captured before the save so the log says what actually moved, rather
        // than restating the new values the officer is already looking at.
        $wasAt = "{$event->localDate()} at {$event->displayTime()}";

        $event->update([
            'title' => $data['title'],
            'category' => $data['category'],
            'starts_at' => Event::combine($data['date'], $data['time']),
            'ends_at' => Event::combine($data['date'], $data['endTime']),
            'description' => $data['description'] ?? null,
        ]);

        $isAt = "{$event->localDate()} at {$event->displayTime()}";
        $moved = $wasAt === $isAt ? '' : " (was {$wasAt})";

        ActivityLog::record('event_updated', "Updated {$event->title} — now {$isAt}{$moved}");

        return response()->json(new EventResource($event->fresh()->load('creator')));
    }

    /**
     * Record what became of an event: done, cancelled, or back to scheduled.
     *
     * Kept off {@see self::update()} because it is a different act with a
     * different consequence — closing an event kills its share link — and
     * because the Secretary marks one done from a list without opening the
     * whole form.
     */
    public function status(Request $request, Event $event): JsonResponse
    {
        Gate::authorize('schedule.manage');

        $data = $request->validate([
            'status' => ['required', Rule::in(EventStatus::values())],
        ], [
            'status.in' => 'That is not a status an event can be in.',
        ]);

        $status = EventStatus::from($data['status']);

        // Closing an event is an account of what happened, so there is nothing
        // to account for until the day has gone by — marking next week's
        // meeting Done would be a claim about the future. Enforced here and not
        // only in the UI, so it holds for any client.
        //
        // Retracting one is always allowed, whatever the date. Without that,
        // an event closed and then rescheduled into the future could never be
        // set right: the correction would be blocked by the very date change
        // that made it necessary.
        if ($status->isClosed() && ! $event->statusIsEditable()) {
            throw ValidationException::withMessages([
                'status' => "This event has not happened yet ({$event->timingLabel()}). Its status can be set once the day has passed.",
            ]);
        }
        $previous = $event->status;

        if ($status !== $previous) {
            $event->update(['status' => $status]);

            // Closing an event withdraws its share link for good. Reopening
            // does not bring it back — sharing again mints a new one — so
            // whoever was sent the old link stays shut out, which is the point
            // of revoking rather than pausing it.
            if ($status->isClosed()) {
                $hadLink = $event->shareUrl() !== null;
                $event->revokeShare();

                if ($hadLink) {
                    ActivityLog::record(
                        'event_share_revoked',
                        "Revoked the share link for {$event->title} — the event is now {$status->label()}",
                    );
                }
            }

            ActivityLog::record(
                'event_status_changed',
                "Marked {$event->title} as {$status->label()} (was {$previous->label()})",
            );
        }

        return response()->json(new EventResource($event->fresh()->load('creator')));
    }

    /**
     * Mint (or return) the link that shares this event's attendance QR.
     *
     * Refused once the event is closed or its day has passed — the same rule
     * the public page enforces, checked here too so a stale button cannot mint
     * a link that would be dead on arrival.
     */
    public function share(Event $event): JsonResponse
    {
        Gate::authorize('schedule.manage');

        if (! $event->canShare()) {
            throw ValidationException::withMessages([
                'status' => $event->shareUnavailableReason() ?? 'This event can no longer be shared.',
            ]);
        }

        $replacing = $event->shareIsRevoked();
        $existing = $event->shareUrl();
        $event->ensureShareToken();

        if (! $existing) {
            ActivityLog::record(
                'event_shared',
                $replacing
                    ? "Created a replacement share link for {$event->title} — the previous one stays revoked"
                    : "Created a share link for {$event->title}",
            );
        }

        return response()->json(new EventResource($event->fresh()->load('creator')));
    }

    /**
     * Remove an event from the calendar.
     *
     * Soft-deleted, so the schedule can be reconstructed after a mistaken
     * delete and the activity log still refers to a row that exists.
     */
    public function destroy(Event $event): JsonResponse
    {
        Gate::authorize('schedule.manage');

        $title = $event->title;
        $when = "{$event->localDate()} at {$event->displayTime()}";

        $event->delete();

        ActivityLog::record('event_deleted', "Removed {$title} from the calendar ({$when})");

        return response()->json(['message' => 'Event removed from the calendar.']);
    }

    /**
     * The event form's fields, shared by create and edit so the two can never
     * drift apart.
     *
     * Date and time arrive as the officer typed them and are combined into one
     * instant on the way to the database — see {@see Event::combine()}.
     *
     * @return array{title:string,category:string,date:string,time:string,endTime:string,description?:string|null}
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string', Rule::in(Event::CATEGORIES)],
            'date' => ['required', 'date_format:Y-m-d'],
            'time' => ['required', 'date_format:H:i'],
            'endTime' => ['required', 'date_format:H:i'],
            'description' => ['nullable', 'string', 'max:5000'],
        ], [
            'title.required' => 'Give the event a name.',
            'category.required' => 'Choose a category.',
            'category.in' => 'That is not one of the available categories.',
            'date.required' => 'Choose a date.',
            'time.required' => 'Choose a start time.',
            'endTime.required' => 'Choose an end time.',
        ]);

        // Compared here rather than with an `after` rule, which works on dates
        // and would have to guess at what day a bare "14:30" belongs to.
        //
        // Both times are on the event's own date, so an event cannot run past
        // midnight. That is a real limit, and the message says so rather than
        // leaving someone to wonder why 10 PM to 1 AM is refused.
        if ($data['endTime'] <= $data['time']) {
            throw ValidationException::withMessages([
                'endTime' => 'The end time must be after the start time, on the same day.',
            ]);
        }

        return $data;
    }
}
