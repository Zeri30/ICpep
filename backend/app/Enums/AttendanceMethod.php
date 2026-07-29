<?php

namespace App\Enums;

/**
 * How an attendance record came to be.
 *
 * Kept because "Present" on its own does not say enough when it is questioned
 * later. An officer who scanned the QR in the room and an officer the Secretary
 * ticked off afterwards are both Present, and the difference between them is
 * exactly what anyone auditing the record wants to know.
 *
 * The column is nullable, and null is a fourth reading rather than missing data:
 * it means nobody did anything — the event closed and
 * {@see \App\Models\Event::recordAbsentees()} wrote the row. That distinction is
 * load-bearing: reopening an event clears the rows nobody chose (see
 * {@see \App\Models\Event::reopenAttendance()}) and leaves every deliberate one
 * alone.
 */
enum AttendanceMethod: string
{
    /** They scanned the event's QR while signed in. */
    case Qr = 'qr';

    /** They typed the six-character code — the camera-failed path. */
    case Code = 'code';

    /** The secretariat set it by hand, on the roster. */
    case Override = 'override';

    public function label(): string
    {
        return match ($this) {
            self::Qr => 'QR scan',
            self::Code => 'Attendance code',
            self::Override => 'Set by an officer',
        };
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(static fn (self $m): string => $m->value, self::cases());
    }
}
