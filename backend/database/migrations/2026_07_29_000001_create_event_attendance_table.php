<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who was at which event.
 *
 * One row per officer per event, enforced by the unique index rather than by
 * whoever remembers to check first: an officer scanning the QR twice, or
 * scanning and then being ticked off by the Secretary, must leave one record
 * and not two.
 *
 * Officers only. There is no members table here because members have no
 * accounts and never check in — the QR carries the *event's* token and nothing
 * about a person, and who scanned it is answered by the session that scanned it.
 *
 * A row is only written once something has actually happened: someone checked
 * in, or the event closed and {@see \App\Models\Event::recordAbsentees()} wrote
 * the rest. An event with no rows is one nobody has taken attendance at yet,
 * which is a different thing from one everybody missed.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Singular on purpose: "attendance" is already the mass noun for the
        // record, and `event_attendances` reads as a plural of a plural. The
        // model names this table explicitly rather than inferring it.
        Schema::create('event_attendance', function (Blueprint $table) {
            $table->id();

            // Hard-deleting an event takes its attendance with it. Events are
            // soft-deleted in practice (see App\Models\Event), so this only
            // fires when a row is genuinely purged — at which point keeping
            // attendance for an event that no longer exists helps nobody.
            $table->foreignId('event_id')->constrained()->cascadeOnDelete();

            // The officer this row is about.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            // present / absent — see App\Enums\AttendanceStatus.
            $table->string('status', 20);

            // qr / code / override, or null when the row was written by the
            // event closing rather than by anyone deciding — see
            // App\Enums\AttendanceMethod.
            $table->string('method', 20)->nullable();

            // When they checked in. Null on an absence, which has no moment.
            $table->timestamp('checked_in_at')->nullable();

            // The officer who set this by hand, on rows that were. Null on a
            // self check-in and on the absences written at close. Nulled rather
            // than cascading if that account is removed: the correction still
            // stands even once the person who made it is gone.
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // One account per officer per event. The whole idempotency of the
            // check-in rests here rather than on application code alone.
            $table->unique(['event_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('event_attendance');
    }
};
