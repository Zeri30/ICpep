<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One line of the roster: an officer, and what the record says about them at
 * one event.
 *
 * Wraps a {@see User} rather than an attendance row, because the roster is a
 * list of officers first and a list of records second — the point of it is
 * seeing who has *not* checked in, and those officers have no row to build a
 * resource from. The record rides along as `attendance`, which is null for
 * exactly those people.
 */
class EventAttendanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        /** @var User $officer */
        $officer = $this->resource;

        // Loaded by the controller through the `attendance` relation constrained
        // to the one event, so this is the officer's row for it or nothing.
        $record = $officer->relationLoaded('attendance')
            ? $officer->attendance->first()
            : null;

        return [
            'userId' => $officer->id,
            'name' => $officer->name,
            'roleLabel' => $officer->role?->label(),

            // Three readings, not two: an officer with no row has not been
            // accounted for yet, which is neither present nor absent. The UI
            // needs to say so plainly rather than defaulting them to absent
            // while the event is still running.
            'status' => $record?->status->value ?? 'pending',
            'statusLabel' => $record?->status->label() ?? 'Not checked in',

            // How the row came to be — null on an absence written by the event
            // closing, which is the case where nobody decided anything.
            'method' => $record?->method?->value,
            'methodLabel' => $record?->method?->label(),

            'checkedInAt' => $record?->checked_in_at?->toIso8601String(),
            'checkedInLabel' => $record?->checkedInLabel(),

            // Who set it by hand, on the rows that were. Present in the payload
            // so a corrected row can say so on its face rather than sending the
            // reader to the activity log.
            'recordedBy' => $record?->relationLoaded('recorder')
                ? $record->recorder?->name
                : null,
        ];
    }
}
