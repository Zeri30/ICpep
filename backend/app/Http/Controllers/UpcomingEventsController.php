<?php

namespace App\Http\Controllers;

use App\Enums\EventStatus;
use App\Models\Event;
use Illuminate\Http\JsonResponse;

/**
 * The public landing page's "Upcoming Events" section.
 *
 * Unauthenticated by design, like the officer board — the point of the
 * section is that a visitor sees it without signing in. Assembled field by
 * field rather than reusing {@see \App\Http\Resources\EventResource}, so that
 * adding something to the admin calendar's payload (an attendance code, a
 * share link) can never quietly publish it here too — see
 * {@see SharedEventController} for the same reasoning.
 *
 * Only events still `Scheduled` and dated today or later are returned. A
 * cancelled or already-Done event, and one whose date has passed, simply drop
 * out of the response on their own the next time the page asks for it — there
 * is nothing to clean up by hand as an event's status changes or its day goes
 * by.
 *
 * Meetings are excluded outright, whatever their date or status: a Meeting on
 * the Secretary's calendar is internal officer business (the same reason the
 * calendar itself is closed to members), not something a visitor to the
 * public site has any reason to see.
 */
class UpcomingEventsController extends Controller
{
    /** Categories that never belong on the public site, however soon they are. */
    private const EXCLUDED_CATEGORIES = ['Meeting'];

    public function index(): JsonResponse
    {
        $events = Event::query()
            ->where('status', EventStatus::Scheduled)
            ->whereNotIn('category', self::EXCLUDED_CATEGORIES)
            ->chronological()
            ->get()
            ->filter(fn (Event $event): bool => $event->timing() !== 'past')
            ->values();

        return response()->json([
            'data' => $events->map(fn (Event $event): array => [
                'id' => $event->id,
                'title' => $event->title,
                'category' => $event->category,
                'venue' => $event->venue,
                'date' => $event->localDate(),
                'dateLabel' => $event->starts_at->setTimezone(Event::timezone())->format('l, F j, Y'),
                'timeLabel' => $event->displayTimeRange(),
                'timing' => $event->timing(),
                'timingLabel' => $event->timingLabel(),
                'description' => $event->description,
            ]),
        ]);
    }
}
