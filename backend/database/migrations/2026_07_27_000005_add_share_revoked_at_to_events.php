<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When an event's share link was withdrawn.
 *
 * Closing an event revokes its link, and reopening the event does not bring it
 * back — a link that a later, unrelated action can silently reactivate is not
 * revoked, it is suspended, and everyone who was ever sent it would quietly
 * regain access. Sharing again mints a fresh token instead.
 *
 * The revoked token stays in the row rather than being nulled, for one reason:
 * a page that can still recognise the link can explain itself. "This event was
 * cancelled" tells the holder what to do next; the "not found" they would get
 * from a discarded token reads as though they copied the URL wrong. The token
 * is only overwritten if the Secretary deliberately shares the event again, by
 * which point a replacement link is already going around.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->timestamp('share_revoked_at')->nullable()->after('share_token');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('share_revoked_at');
        });
    }
};
