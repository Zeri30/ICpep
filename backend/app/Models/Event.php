<?php

namespace App\Models;

use App\Enums\AttendanceMethod;
use App\Enums\AttendanceStatus;
use App\Enums\EventStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * One scheduled event on the organization's calendar.
 *
 * Created, edited and deleted by whoever holds
 * {@see \App\Enums\Permission::ManageSchedule} — the Secretary and the
 * Assistant Secretary by default; every other officer role reads it. The
 * calendar is internal: members have no accounts and never see it.
 *
 * ## Timezone
 *
 * `starts_at` is stored in UTC, like every other timestamp in this schema. The
 * date and time an officer types are wall-clock times in
 * {@see self::timezone()} — the organization's timezone, not the viewer's
 * device's — so they are converted on the way in ({@see self::combine()}) and
 * back again on the way out ({@see self::localDate()}, {@see self::localTime()}).
 *
 * The API therefore sends the already-converted date and time strings alongside
 * the UTC instant, and the calendar renders those directly. Handing the browser
 * a UTC instant to format itself would put an event on the wrong day for an
 * officer travelling, or on a laptop whose clock is set to the wrong region —
 * a calendar that disagrees with itself depending on who opens it is worse than
 * one that is simply always Manila time.
 *
 * @property string $title
 * @property string $category
 * @property CarbonImmutable $starts_at
 * @property string|null $description
 * @property string $qr_token
 * @property string $attendance_code
 * @property EventStatus $status
 * @property string|null $share_token
 * @property CarbonImmutable|null $share_revoked_at
 */
class Event extends Model
{
    use SoftDeletes;

    /**
     * The kinds of event the secretariat can schedule.
     *
     * The first five mirror the categories the public site already uses for its
     * events (frontend/lib/data.ts), so the same event is filed the same way in
     * both places; the rest cover the internal calendar's own business.
     *
     * Adding one is safe: it is validated against this list and rendered from
     * it, and existing rows keep whatever they were saved with.
     *
     * @var list<string>
     */
    public const CATEGORIES = [
        'Meeting',
        'Seminar',
        'Workshop',
        'Competition',
        'Major Event',
        'General Assembly',
        'Deadline',
        'Other',
    ];

    /**
     * The alphabet the attendance code is drawn from.
     *
     * Deliberately missing 0/O and 1/I/L: the code gets read aloud in a noisy
     * room and typed on a phone keyboard, where those pairs are guessed wrong
     * often enough to matter. 32 characters over 6 places is about a billion
     * combinations, which is ample for codes that identify an event rather than
     * protect one.
     */
    public const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

    protected $fillable = [
        'title',
        'category',
        'starts_at',
        'ends_at',
        'description',
        'created_by',
        'status',
    ];

    /**
     * The column default again, in the model.
     *
     * The database default only applies once the row is written, so a
     * just-created instance would carry a null status until something refetched
     * it — and anything reading `$event->status->label()` in between (the
     * resource answering the create request, for one) would fatal on null.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => EventStatus::Scheduled->value,
    ];

    /**
     * The QR token and attendance code are assigned as the row is inserted, so
     * they exist for every event and only ever for a saved one. A form that is
     * opened and abandoned reserves nothing.
     */
    protected static function booted(): void
    {
        static::creating(function (self $event): void {
            $event->qr_token ??= self::freshQrToken();
            $event->attendance_code ??= self::freshAttendanceCode();
        });
    }

    /** An unguessable token, unique across every event including deleted ones. */
    public static function freshQrToken(): string
    {
        return self::unique('qr_token', static fn (): string => Str::random(48));
    }

    /** A six-character code an officer can be told out loud. */
    public static function freshAttendanceCode(): string
    {
        return self::unique('attendance_code', static function (): string {
            $alphabet = self::CODE_ALPHABET;
            $code = '';

            for ($i = 0; $i < 6; $i++) {
                // random_int, not rand: these are credentials, and a predictable
                // sequence would let one be worked out from another.
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }

            return $code;
        });
    }

    /**
     * Draw values until one is not already taken.
     *
     * Soft-deleted events are counted as taken: their rows still hold the
     * unique index, so reusing a value would fail the insert — and a code that
     * once belonged to a cancelled event should not quietly come back as a
     * different one.
     *
     * @param  callable():string  $make
     */
    private static function unique(string $column, callable $make): string
    {
        // A collision is vanishingly unlikely; looping forever on a broken
        // generator is not, so the attempts are bounded and loud.
        for ($attempt = 0; $attempt < 20; $attempt++) {
            $value = $make();

            if (! self::withTrashed()->where($column, $value)->exists()) {
                return $value;
            }
        }

        throw new RuntimeException("Could not generate a unique {$column} for the event.");
    }

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime',
            'ends_at' => 'immutable_datetime',
            'share_revoked_at' => 'immutable_datetime',
            'status' => EventStatus::class,
        ];
    }

    /* ------------------------------------------------------------- timing */

    /**
     * Where the event sits relative to today: `upcoming`, `today` or `past`.
     *
     * Worked out from the date, in the organization's timezone — which is why
     * it is not a column. A stored "past" flag would need something to come
     * along and flip it at midnight, and would be wrong until that happened.
     */
    public function timing(): string
    {
        $days = $this->daysFromToday();

        return match (true) {
            $days > 0 => 'upcoming',
            $days === 0 => 'today',
            default => 'past',
        };
    }

    /**
     * How far off the event is, in words: "Today", "Tomorrow", "3 days ago".
     *
     * Coarsens as it gets further away — "in 87 days" is a number nobody reads
     * as a length of time, while "in 3 months" is.
     */
    public function timingLabel(): string
    {
        $days = $this->daysFromToday();
        $ago = abs($days);

        return match (true) {
            $days === 0 => 'Today',
            $days === 1 => 'Tomorrow',
            $days === -1 => 'Yesterday',
            $ago < 14 => $days > 0 ? "In {$ago} days" : "{$ago} days ago",
            $ago < 60 => self::plural(intdiv($ago, 7), 'week', $days > 0),
            default => self::plural(intdiv($ago, 30), 'month', $days > 0),
        };
    }

    /** Whole days between today and the event's day, negative once it has passed. */
    public function daysFromToday(): int
    {
        $timezone = self::timezone();
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $day = $this->starts_at->setTimezone($timezone)->startOfDay();

        return (int) $today->diffInDays($day, false);
    }

    private static function plural(int $count, string $unit, bool $future): string
    {
        $word = $count === 1 ? $unit : "{$unit}s";

        return $future ? "In {$count} {$word}" : "{$count} {$word} ago";
    }

    /* ------------------------------------------------------------- status */

    /**
     * How long after an event ends before the calendar starts asking what
     * became of it.
     *
     * An event that runs to 4 PM is rarely over at 4 PM — people linger, and
     * the officer who would close it off is the one still packing up. An hour
     * is long enough that the question never arrives while the event is still
     * going, and short enough that it gets answered the same afternoon, by
     * someone who was there, rather than the next morning from memory.
     *
     * ⚠ The wording is written out in three places rather than derived from
     * this number — the refusal in EventController::status(), and two lines in
     * the frontend's StatusControl. Changing it here means changing "an hour"
     * in all three, or they quietly start lying.
     */
    public const STATUS_GRACE_MINUTES = 60;

    /**
     * Has this event finished with nobody saying what became of it?
     *
     * The signal the calendar surfaces so an event does not simply slide into
     * the past unaccounted for. It is not an error — it is a reminder aimed at
     * the roles that can clear it.
     */
    public function needsStatusUpdate(): bool
    {
        return $this->statusIsEditable() && ! $this->status->isClosed();
    }

    /**
     * May the secretariat record what became of this event yet?
     *
     * Only once it is over and the grace period has run out. Status is an
     * account of what happened, and nobody can give one before it has — an
     * event marked Done the week before would be a claim about the future.
     *
     * Measured from the event's own end time rather than the end of its day:
     * a meeting that finished at 10 AM is finished, and waiting until midnight
     * to ask about it means asking the following morning, once everyone who
     * could answer has gone home.
     *
     * The cost of the rule: an event called off in advance cannot be marked
     * Cancelled until it would have finished. Until then the way to take it off
     * the calendar is to delete it.
     */
    public function statusIsEditable(): bool
    {
        return $this->wrapsUpAt()->isPast();
    }

    /**
     * The instant this event counts as closed off: an hour after it ends.
     *
     * A row saved before end times were recorded has none to measure from, so
     * it is taken as an hour long. Assuming a length rather than falling back
     * to the old end-of-day rule keeps one answer to "when does this become
     * askable", which is the thing the UI has to be able to state.
     */
    public function wrapsUpAt(): CarbonImmutable
    {
        $ends = $this->ends_at ?? $this->starts_at->addHour();

        return $ends->addMinutes(self::STATUS_GRACE_MINUTES);
    }

    /* --------------------------------------------------------- attendance */

    /**
     * Are this event's QR token and attendance code still good?
     *
     * Valid up to and including the event's own day, and dead the moment that
     * day has gone by or the event has been closed off. Scanning the QR for
     * last week's meeting, or typing its code, has to fail — otherwise
     * attendance can be recorded for something that already finished.
     *
     * Deliberately looser than {@see self::statusIsEditable()}, which turns on
     * an instant an hour after the event ends. The two answer different
     * questions: how long a code stays usable for a straggler still queueing,
     * versus when someone can give an account of what happened. A QR that died
     * at 4:01 PM would be the wrong answer to the first. The consequence of the
     * split is that closing an event early kills a code the day would still
     * have allowed — which is correct, because closing it is someone saying it
     * is over.
     *
     * Enforced in {@see \App\Http\Controllers\Api\Admin\AttendanceController},
     * which is the only thing that turns a token or a code into a record. This
     * method is the rule, in one place; anything else accepting either must
     * check it first.
     */
    public function acceptsAttendance(): bool
    {
        return ! $this->status->isClosed() && $this->daysFromToday() >= 0;
    }

    /**
     * Why the QR and the code are not being accepted, in words — null while
     * they are.
     *
     * The one place the refusal is worded. The check-in page and the share
     * panel both show it, so an officer whose scan is turned away and the
     * Secretary looking at why the link died read the same sentence.
     */
    public function attendanceClosedReason(): ?string
    {
        return match (true) {
            $this->status === EventStatus::Cancelled => 'This event was cancelled.',
            $this->status === EventStatus::Done => 'This event has already taken place.',
            $this->daysFromToday() < 0 => 'This event has already passed.',
            default => null,
        };
    }

    /** Every attendance record for this event — officers only; see the model. */
    public function attendance(): HasMany
    {
        return $this->hasMany(EventAttendance::class);
    }

    /**
     * One officer's record for this event, or null if they have none.
     *
     * Reads a loaded relation when there is one and falls back to a query when
     * there is not. That is what lets the calendar send every officer their own
     * standing without an N+1: the index constrains the relation to the signed-in
     * officer and eager-loads it once, while the single-event responses (create,
     * edit, share) pay for one small query rather than having to remember to
     * load it.
     */
    public function attendanceFor(User $officer): ?EventAttendance
    {
        if ($this->relationLoaded('attendance')) {
            return $this->attendance->firstWhere('user_id', $officer->id);
        }

        return $this->attendance()->where('user_id', $officer->id)->first();
    }

    /**
     * Find the event a scanned QR belongs to, expired or not.
     *
     * Deliberately does not filter on {@see self::acceptsAttendance()}: an
     * officer who scans last week's QR should be told the event has passed, not
     * that the code is unrecognised. Whether to accept it is the caller's
     * decision and a separate one.
     */
    public static function byQrToken(string $token): ?self
    {
        return static::where('qr_token', $token)->first();
    }

    /**
     * Find the event a typed code belongs to.
     *
     * Matched case-insensitively, because the code is read aloud and typed on a
     * phone keyboard that will happily offer lowercase — and the alphabet it is
     * drawn from ({@see self::CODE_ALPHABET}) has no character whose case
     * carries meaning, so upcasing can never turn one valid code into another.
     */
    public static function byAttendanceCode(string $code): ?self
    {
        return static::where('attendance_code', strtoupper(trim($code)))->first();
    }

    /**
     * Record that an officer is here.
     *
     * Idempotent by design, and not only by the unique index: scanning the QR a
     * second time is the most likely thing to happen in a room where the phone
     * did not obviously respond the first time, and it must neither error nor
     * quietly restamp the time. An officer already Present is returned
     * untouched, so the record keeps saying when they actually arrived.
     *
     * An officer already marked Absent — closed off and then turning up late —
     * is flipped to Present with the time they finally scanned, which is the
     * whole reason the roster stays correctable.
     *
     * Does *not* check {@see self::acceptsAttendance()}. That is the caller's
     * job, because the two answers ("is this event still taking attendance" and
     * "record this") belong to different questions and only the caller knows
     * which refusal to report.
     */
    public function checkIn(User $officer, AttendanceMethod $method): EventAttendance
    {
        $record = $this->attendance()->firstOrNew(['user_id' => $officer->id]);

        if ($record->exists && $record->isPresent()) {
            return $record;
        }

        $record->fill([
            'status' => AttendanceStatus::Present,
            'method' => $method,
            'checked_in_at' => now(),
            // Cleared, so a self check-in is never attributed to whoever last
            // corrected the row.
            'recorded_by' => null,
        ])->save();

        return $record;
    }

    /**
     * Set an officer's status by hand, as the secretariat correcting the roster.
     *
     * Real meetings have dead phones and people who arrive after the QR has been
     * put away. A roster that cannot be corrected is one that gets abandoned in
     * favour of a sheet of paper, so this is a first-class action rather than a
     * repair hatch — which is why it is stamped {@see AttendanceMethod::Override}
     * and carries who made it.
     */
    public function setAttendance(User $officer, AttendanceStatus $status, User $by): EventAttendance
    {
        $record = $this->attendance()->firstOrNew(['user_id' => $officer->id]);

        $record->fill([
            'status' => $status,
            'method' => AttendanceMethod::Override,
            // An absence has no moment, so marking someone absent drops the
            // check-in time rather than leaving one behind that contradicts it.
            'checked_in_at' => $status === AttendanceStatus::Present
                ? ($record->checked_in_at ?? now())
                : null,
            'recorded_by' => $by->id,
        ])->save();

        return $record;
    }

    /**
     * Close attendance off: every active officer without a record is Absent.
     *
     * Runs when the event is marked Done. Until then the missing rows are
     * genuinely unknown — an event still hours away has nothing to say about
     * anyone — and this is the moment that stops being true.
     *
     * Cancelled events are left alone by the caller: nothing took place, so
     * nobody missed it, and a roster of eleven absences for a meeting that never
     * happened would be a false record rather than an empty one.
     *
     * The written rows carry no method, which is what marks them as nobody's
     * decision and lets {@see self::reopenAttendance()} take them back.
     *
     * @return int how many absences were recorded
     */
    public function recordAbsentees(): int
    {
        $accountedFor = $this->attendance()->pluck('user_id');

        $missing = User::query()
            ->where('is_active', true)
            ->whereNotIn('id', $accountedFor)
            ->pluck('id');

        if ($missing->isEmpty()) {
            return 0;
        }

        $now = now();

        $this->attendance()->insert($missing->map(fn (int $id): array => [
            'event_id' => $this->id,
            'user_id' => $id,
            'status' => AttendanceStatus::Absent->value,
            'method' => null,
            'checked_in_at' => null,
            'recorded_by' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());

        return $missing->count();
    }

    /**
     * Take back the absences the closing wrote, and nothing else.
     *
     * An event closed by mistake and set back to Scheduled should not leave
     * eleven officers marked absent from a meeting that has not happened yet.
     * Only the rows nobody chose go: every check-in stands, and so does every
     * correction the secretariat made by hand — those are decisions, and
     * reopening an event is not a reason to discard them.
     *
     * @return int how many were withdrawn
     */
    public function reopenAttendance(): int
    {
        return $this->attendance()
            ->where('status', AttendanceStatus::Absent)
            ->whereNull('method')
            ->delete();
    }

    /* -------------------------------------------------------------- share */

    /**
     * May this event's QR be shared right now?
     *
     * Exactly while the QR itself is still good — defined in terms of
     * {@see self::acceptsAttendance()} rather than repeating the condition, so
     * the two can never drift into a link that hands out a dead code.
     */
    public function canShare(): bool
    {
        return $this->acceptsAttendance();
    }

    /**
     * Why sharing is unavailable, in words the recipient of a dead link can use.
     *
     * The same sentence the check-in refuses with, because it is the same rule —
     * a share link exists to hand out credentials, and it dies exactly when they
     * stop being accepted.
     */
    public function shareUnavailableReason(): ?string
    {
        return $this->attendanceClosedReason();
    }

    /** Has the current token been withdrawn? Revoked tokens never come back. */
    public function shareIsRevoked(): bool
    {
        return $this->share_revoked_at !== null;
    }

    /**
     * The live share link, or null if this event has never been shared or its
     * link has been revoked.
     *
     * Generating is deliberately a separate act ({@see self::ensureShareToken()})
     * rather than something every event gets at creation — a link that exists
     * is a link that can leak, and most events are never shared at all.
     */
    public function shareUrl(): ?string
    {
        return $this->share_token && ! $this->shareIsRevoked()
            ? rtrim((string) config('icpep.frontend_url'), '/')."/events/{$this->share_token}"
            : null;
    }

    /**
     * Withdraw the share link, if there is one to withdraw.
     *
     * The token is kept so the page it points at can still say why it stopped
     * working; {@see self::ensureShareToken()} will not reuse it.
     */
    public function revokeShare(): void
    {
        if ($this->share_token && ! $this->shareIsRevoked()) {
            $this->forceFill(['share_revoked_at' => now()])->save();
        }
    }

    /**
     * The event's live share token, minting one if needed.
     *
     * A revoked link is replaced rather than reinstated: the old URL stays dead
     * for everyone already holding it, which is the whole point of having
     * revoked it. Sharing an event again is therefore a new decision with a new
     * link, not an undo.
     */
    public function ensureShareToken(): string
    {
        if (! $this->share_token || $this->shareIsRevoked()) {
            $this->forceFill([
                'share_token' => self::unique('share_token', static fn (): string => Str::random(40)),
                'share_revoked_at' => null,
            ])->save();
        }

        return $this->share_token;
    }

    /** The officer who scheduled it; null once their account is removed. */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * What the QR code encodes: an absolute URL to the check-in route carrying
     * this event's token.
     *
     * Absolute because a phone camera has no page to resolve a relative path
     * against. Built from the configured frontend URL rather than the request,
     * so the code a Secretary generates points at the deployed admin and not at
     * whatever host they happen to have open.
     *
     * ⚠ The path is load-bearing and cannot be changed: QR codes carrying it
     * have already been handed out, and they are printed and photographed
     * artefacts that no deploy can reach. The frontend route is a page in its
     * own layout for exactly that reason — see the check-in page's own note on
     * why it does not sit under the admin shell.
     */
    public function checkInUrl(): string
    {
        return rtrim((string) config('icpep.frontend_url'), '/')."/admin/check-in?token={$this->qr_token}";
    }

    /** The organization's timezone — the one every date on the calendar means. */
    public static function timezone(): string
    {
        return config('icpep.timezone', 'Asia/Manila');
    }

    /**
     * Turn the date and time an officer typed into the instant to store.
     *
     * @param  string  $date  Y-m-d as entered
     * @param  string  $time  H:i as entered
     */
    public static function combine(string $date, string $time): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat(
            'Y-m-d H:i',
            "{$date} ".substr($time, 0, 5),
            self::timezone(),
        )->utc();
    }

    /** The calendar day this falls on, in the organization's timezone. */
    public function localDate(): string
    {
        return $this->starts_at->setTimezone(self::timezone())->format('Y-m-d');
    }

    /** The time of day, in the organization's timezone, ready for a time input. */
    public function localTime(): string
    {
        return $this->starts_at->setTimezone(self::timezone())->format('H:i');
    }

    /** The end time, ready for a time input, or null on a legacy row. */
    public function localEndTime(): ?string
    {
        return $this->ends_at?->setTimezone(self::timezone())->format('H:i');
    }

    /** "7:30 PM" — for reading, not for a form field. */
    public function displayTime(): string
    {
        return $this->starts_at->setTimezone(self::timezone())->format('g:i A');
    }

    public function displayEndTime(): ?string
    {
        return $this->ends_at?->setTimezone(self::timezone())->format('g:i A');
    }

    /** "7:30 PM – 9:00 PM", or just the start when there is no end recorded. */
    public function displayTimeRange(): string
    {
        $end = $this->displayEndTime();

        return $end ? "{$this->displayTime()} – {$end}" : $this->displayTime();
    }

    /**
     * Soonest first. The calendar and the list beside it both read in this
     * order, so an event never appears above one that happens before it.
     *
     * @param  Builder<Event>  $query
     * @return Builder<Event>
     */
    public function scopeChronological(Builder $query): Builder
    {
        return $query->orderBy('starts_at')->orderBy('id');
    }
}
