<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * @mixin \App\Models\Event
 */
class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category,

            // The calendar day and time of day, already in the organization's
            // timezone. The grid groups on `date` and the form fills from
            // `date`/`time`, so neither has to guess what the viewer's device
            // clock is set to — see the timezone note on App\Models\Event.
            'date' => $this->localDate(),
            'time' => $this->localTime(),
            'endTime' => $this->localEndTime(),
            'timeLabel' => $this->displayTime(),
            'endTimeLabel' => $this->displayEndTime(),
            'timeRangeLabel' => $this->displayTimeRange(),

            // The underlying instant, for anything that needs to compare or sort
            // rather than display.
            'startsAt' => $this->starts_at->toIso8601String(),

            'description' => $this->description,

            // What became of it, and where it sits relative to today. The two
            // are independent: a date that has passed does not say the event
            // happened, which is exactly what `needsStatusUpdate` is about.
            'status' => $this->status->value,
            'statusLabel' => $this->status->label(),
            'timing' => $this->timing(),
            'timingLabel' => $this->timingLabel(),
            'needsStatusUpdate' => $this->needsStatusUpdate(),
            // Whether the status may be set yet — only once the day has gone
            // by. The UI disables the control on this rather than re-deriving
            // the rule from the date and risking a different answer.
            'statusEditable' => $this->statusIsEditable(),
            // Whether the QR and code are still good. Nothing validates them
            // yet (there is no check-in endpoint), but the calendar can already
            // say plainly that they have expired.
            'acceptsAttendance' => $this->acceptsAttendance(),

            // The attendance credentials and the share link, sent only to
            // whoever runs the schedule. The token is the whole secret behind a
            // check-in, so it has no business in the calendar payload every
            // officer receives — and the index endpoint is open to all of them.
            $this->mergeWhen(Gate::allows('schedule.manage'), fn (): array => [
                'qrUrl' => $this->checkInUrl(),
                'attendanceCode' => $this->attendance_code,
                'canShare' => $this->canShare(),
                'shareUrl' => $this->shareUrl(),
                // Distinguishes "never shared" from "shared and withdrawn" —
                // both leave shareUrl null, but only one means a new link would
                // be a replacement.
                'shareRevoked' => $this->shareIsRevoked(),
                'shareBlockedReason' => $this->shareUnavailableReason(),
            ]),

            'createdBy' => $this->whenLoaded('creator', fn () => $this->creator?->name),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
