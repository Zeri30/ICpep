<?php

use App\Enums\EventStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What became of an event, and the link that shares its attendance QR.
 *
 * `status` is the Secretary's account of the event — scheduled, done, or
 * cancelled. It is not derived from the date: a date that has passed says the
 * event was due, not that it happened, and the calendar needs to be able to
 * show the difference (see {@see EventStatus}).
 *
 * `share_token` is generated on request rather than at creation, because a
 * share link is an act with a decision behind it — the Secretary chooses to
 * hand this event's QR around. Events nobody shares never get one.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('status', 20)
                ->default(EventStatus::Scheduled->value)
                ->after('description');

            // Separate from qr_token so the address bar of a shared page never
            // carries the check-in secret itself, and so a share can be revoked
            // later without invalidating the QR handed out in the room.
            $table->string('share_token', 64)->nullable()->unique()->after('attendance_code');

            // The calendar filters on "not yet accounted for", which reads this.
            $table->index(['status', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropIndex(['status', 'starts_at']);
            $table->dropUnique(['share_token']);
            $table->dropColumn(['status', 'share_token']);
        });
    }
};
