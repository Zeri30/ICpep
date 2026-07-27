<?php

namespace App\Enums;

/**
 * What the Secretary says became of an event.
 *
 * Deliberately separate from *when* the event is (see
 * {@see \App\Models\Event::timing()}), which the calendar works out from the
 * date on its own. A date that has passed only tells you the event was
 * scheduled to happen — not whether it did. An event can be cancelled a week
 * ahead of time and one that has come and gone may still be waiting for someone
 * to say how it went, and the calendar has to be able to show both.
 *
 * That gap is the point: an event whose date has passed while still `Scheduled`
 * is one nobody has closed off, and the calendar flags it rather than quietly
 * assuming it happened.
 */
enum EventStatus: string
{
    /** Booked and expected to happen — the state every event starts in. */
    case Scheduled = 'scheduled';

    /** It happened. */
    case Done = 'done';

    /** It was called off. */
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Scheduled => 'Scheduled',
            self::Done => 'Done',
            self::Cancelled => 'Cancelled',
        };
    }

    /**
     * Has the Secretary settled what happened to this event?
     *
     * Both closed states end an event's life: its attendance QR stops working
     * and its share link goes dead.
     */
    public function isClosed(): bool
    {
        return $this !== self::Scheduled;
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(static fn (self $s): string => $s->value, self::cases());
    }

    /** @return list<array{value:string,label:string}> for the frontend controls. */
    public static function options(): array
    {
        return array_map(
            static fn (self $s): array => ['value' => $s->value, 'label' => $s->label()],
            self::cases(),
        );
    }
}
