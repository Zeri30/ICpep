<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\JsonResponse;

/**
 * The public face of a shared event: the details, the attendance QR, and the
 * code to type when a camera will not read it.
 *
 * Unauthenticated by design — the point of a share link is that it can be sent
 * to a group chat or put on a screen without everyone signing in first. The
 * token in the URL is the only credential, which is why it is long and random.
 *
 * The response is assembled here field by field rather than reusing
 * {@see \App\Http\Resources\EventResource}, so that adding something to the
 * admin's payload can never quietly publish it. Everything below is meant to be
 * read by whoever holds the link; nothing else travels.
 */
class SharedEventController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $event = Event::where('share_token', $token)->first();

        // An unknown token and a deleted event are the same answer: there is
        // nothing here. Saying which would confirm that a token once existed.
        if (! $event) {
            return response()->json(['message' => 'This link is not valid.'], 404);
        }

        // Live rules, not the state at the time the link was made: an event
        // cancelled after sharing takes its link down with it.
        //
        // A revoked token is refused even if the event has since been reopened.
        // Recognising the token is only so this page can say what happened —
        // it never makes the link work again, and the Secretary sharing the
        // event a second time issues a different one.
        if ($event->shareIsRevoked() || ! $event->canShare()) {
            return response()->json([
                'available' => false,
                'title' => $event->title,
                'reason' => $event->shareUnavailableReason()
                    ?? 'This link has been withdrawn. Ask the Secretary for the current one.',
            ], 410);
        }

        return response()->json([
            'available' => true,
            'title' => $event->title,
            'category' => $event->category,
            'date' => $event->localDate(),
            'dateLabel' => $event->starts_at->setTimezone(Event::timezone())->format('l, F j, Y'),
            'timeLabel' => $event->displayTimeRange(),
            'timingLabel' => $event->timingLabel(),
            'timing' => $event->timing(),
            'description' => $event->description,
            'organization' => 'ICpEP.SE',
            'timezone' => Event::timezone(),
            'qrUrl' => $event->checkInUrl(),
            'attendanceCode' => $event->attendance_code,
        ]);
    }
}
