<?php

namespace App\Http\Resources;

use App\Enums\AttendanceStatus;
use App\Enums\EventStatus;
use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * @mixin Event
 */
class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'category' => $this->category,
            'venue' => $this->venue,

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
            // Whether the status may be set yet — only from an hour after the
            // event ends. The UI disables the control on this rather than
            // re-deriving the rule from the clock: the answer turns on the
            // server's, and a browser whose clock is a few minutes fast would
            // otherwise offer a button the endpoint refuses.
            'statusEditable' => $this->statusIsEditable(),
            // Whether the QR and code are still good — enforced by the check-in
            // endpoint, and said here so the calendar can show plainly that they
            // have expired.
            'acceptsAttendance' => $this->acceptsAttendance(),

            // Where the officer reading this stands with this event.
            //
            // Sent to every role, unlike the roster. The roster says who missed
            // which meeting and is the secretariat's; your own attendance is
            // simply yours, and an officer who scanned a QR has no other way to
            // confirm it landed — or to notice they were marked absent from
            // something they were at, which is the case worth catching early.
            'myAttendance' => $this->myAttendance($request),

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

    /**
     * The signed-in officer's own attendance line.
     *
     * Always an object rather than sometimes null, so the UI reads one shape:
     * `pending` is the honest answer for an event nobody has taken attendance at
     * yet, and it is the same word the roster uses for the same state.
     *
     * A missing record reads as `absent` the moment the event's own end time
     * has passed, computed here rather than waited for — the row itself is
     * only written the next time somebody opens the roster (see
     * AttendanceController::index() and Event::recordAbsentees()), and an
     * officer checking their own standing should not have to wait on that.
     * Not for a cancelled event: nothing took place, so nobody missed it.
     *
     * `canCheckIn` is the one thing the officer can act on — it is true only
     * while the codes are live, the event's attendance is not yet locked,
     * *and* they are not already on the record, which is exactly when
     * showing them a way in is worth doing. Once attendance is locked, this
     * panel is not offering a way back in even on the same day — see
     * Event::attendanceLocked().
     *
     * @return array<string, mixed>
     */
    private function myAttendance(Request $request): array
    {
        $officer = $request->user();
        $record = $officer ? $this->attendanceFor($officer) : null;

        $status = $record?->status
            ?? ($this->attendanceLocked() && $this->status !== EventStatus::Cancelled
                ? AttendanceStatus::Absent
                : null);

        return [
            'status' => $status?->value ?? 'pending',
            'statusLabel' => $status?->label() ?? 'Not checked in',
            'methodLabel' => $record?->method?->label(),
            'checkedInLabel' => $record?->checkedInLabel(),
            'canCheckIn' => $this->acceptsAttendance()
                && ! $this->attendanceLocked()
                && ! (bool) $record?->isPresent(),
        ];
    }
}
