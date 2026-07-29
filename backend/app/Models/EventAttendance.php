<?php

namespace App\Models;

use App\Enums\AttendanceMethod;
use App\Enums\AttendanceStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One officer's attendance at one event.
 *
 * Written by {@see Event::checkIn()} when someone scans or types the code, by
 * the roster when the secretariat corrects a status, and by
 * {@see Event::recordAbsentees()} when the event is closed off. Nothing else
 * creates these, so the three ways a row can come to exist are the three values
 * {@see AttendanceMethod} can hold — plus null, for the ones the closing wrote.
 *
 * @property int $event_id
 * @property int $user_id
 * @property AttendanceStatus $status
 * @property AttendanceMethod|null $method
 * @property CarbonImmutable|null $checked_in_at
 * @property int|null $recorded_by
 */
class EventAttendance extends Model
{
    /** @see the migration — singular, because "attendances" is a plural of a plural. */
    protected $table = 'event_attendance';

    protected $fillable = [
        'event_id',
        'user_id',
        'status',
        'method',
        'checked_in_at',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => AttendanceStatus::class,
            'method' => AttendanceMethod::class,
            'checked_in_at' => 'immutable_datetime',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    /** The officer this row is about. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The officer who set it by hand, on the rows that were. */
    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function isPresent(): bool
    {
        return $this->status === AttendanceStatus::Present;
    }

    /**
     * Did anyone actually decide this, or did the event closing write it?
     *
     * The distinction {@see Event::reopenAttendance()} clears on: an event
     * reopened by mistake should lose the absences nobody chose and keep every
     * check-in and every correction.
     */
    public function wasDecided(): bool
    {
        return $this->method !== null;
    }

    /** "Checked in at 7:02 PM", in the organization's timezone. */
    public function checkedInLabel(): ?string
    {
        return $this->checked_in_at?->setTimezone(Event::timezone())->format('g:i A');
    }
}
