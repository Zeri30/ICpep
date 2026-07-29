<?php

use App\Models\Event;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When an event finishes.
 *
 * Stored in UTC alongside `starts_at`, and entered as a wall-clock time in the
 * organization's timezone like everything else on the calendar.
 *
 * Nullable in the schema but required by the form: events scheduled before this
 * existed have no end time, and are backfilled below with an hour rather than
 * being left for someone to trip over. Keeping the column nullable means a row
 * written by something other than the form — a future import, a fixture — never
 * fails on a field the calendar can render an em-dash for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('ends_at')->nullable()->after('starts_at');
        });

        // An hour is a guess, but a better one than nothing: every existing
        // event was scheduled without an end, so any value here is arbitrary —
        // this one at least renders sensibly and is easy to correct.
        Event::withTrashed()->whereNull('ends_at')->get()->each(function (Event $event): void {
            $event->forceFill(['ends_at' => $event->starts_at->addHour()])->saveQuietly();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('ends_at');
        });
    }
};
