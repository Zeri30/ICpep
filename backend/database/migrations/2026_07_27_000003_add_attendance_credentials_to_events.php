<?php

use App\Models\Event;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The two credentials an event carries for taking attendance: a QR token, and a
 * short code for the officers whose camera will not cooperate.
 *
 * Both are generated when the event row is created (see {@see Event::booted()})
 * and never before it — nothing is reserved while a form sits open, so an
 * abandoned form leaves no orphaned code behind.
 *
 * Nullable rather than NOT NULL: events created before this migration have no
 * credentials until it backfills them below, and a unique index tolerates the
 * gap in every supported driver while a NOT NULL default could not be made
 * unique. Rows created from here on always have both, because the model fills
 * them in before the insert.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            // Long and unguessable: this is the whole secret behind a check-in,
            // so it must not be worth trying to guess.
            $table->string('qr_token', 64)->nullable()->unique()->after('description');

            // Short enough to read aloud across a room and type on a phone.
            $table->string('attendance_code', 6)->nullable()->unique()->after('qr_token');
        });

        // Events scheduled before this existed still need to be usable.
        Event::withTrashed()->whereNull('qr_token')->get()->each(function (Event $event): void {
            $event->forceFill([
                'qr_token' => Event::freshQrToken(),
                'attendance_code' => Event::freshAttendanceCode(),
            ])->saveQuietly();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropUnique(['qr_token']);
            $table->dropUnique(['attendance_code']);
            $table->dropColumn(['qr_token', 'attendance_code']);
        });
    }
};
