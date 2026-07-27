<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Scheduled events — the organization's internal calendar, maintained by the
 * Secretary and readable by every officer.
 *
 * Separate from the public website's hand-curated Events section (see
 * frontend/lib/data.ts): that one is marketing copy with photography, this one
 * is the working schedule. Nothing here reaches the public site today.
 *
 * `starts_at` is stored in UTC like every other timestamp in the schema; the
 * date and time the Secretary typed are wall-clock times in the organization's
 * timezone, converted on the way in and back again on the way out (see
 * {@see \App\Models\Event}). Storing the officer's local time verbatim would
 * put an event on the wrong day for anyone whose device is set elsewhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();

            $table->string('title');

            // What kind of event this is — drives the colour coding and the
            // filter on the calendar. Constrained in the application layer
            // (Event::CATEGORIES) rather than as a database enum, so adding one
            // is a code change and not a migration.
            $table->string('category');

            // Date and time of day, as one instant.
            $table->timestamp('starts_at');

            $table->text('description')->nullable();

            // Who scheduled it. Nulled rather than cascading if the account is
            // removed — the event outlives whoever created it.
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->softDeletes();
            $table->timestamps();

            // The calendar always reads a window of dates in order.
            $table->index('starts_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
