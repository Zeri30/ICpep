<?php

namespace App\Enums;

/**
 * Whether an officer was at an event.
 *
 * Only two states are ever stored. An officer with no row at all is a third
 * reading — nobody has said either way yet — and it is deliberately the absence
 * of a record rather than a case here: an event still hours away has nothing to
 * say about anyone, and writing "not yet" rows for every officer the moment an
 * event is created would fill the table with an answer nobody gave.
 *
 * That gap closes when the event does. {@see \App\Models\Event::recordAbsentees()}
 * turns every officer still without a row into an Absent one, so a closed event
 * has an account for everybody and an open one only has the people who turned up.
 */
enum AttendanceStatus: string
{
    /** They checked in — by QR, by code, or because the Secretary said so. */
    case Present = 'present';

    /** They did not, and the event is over. */
    case Absent = 'absent';

    public function label(): string
    {
        return match ($this) {
            self::Present => 'Present',
            self::Absent => 'Absent',
        };
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(static fn (self $s): string => $s->value, self::cases());
    }
}
