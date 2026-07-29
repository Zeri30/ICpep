<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Where an event is held.
 *
 * Nullable and free text, like the description: a room number, a building, an
 * off-campus address, or a video call link are all valid answers and none of
 * them fit a fixed list the way category does.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->string('venue')->nullable()->after('category');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('venue');
        });
    }
};
