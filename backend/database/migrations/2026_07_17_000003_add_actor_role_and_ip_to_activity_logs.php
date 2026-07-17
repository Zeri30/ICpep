<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Richer auditing: record which role the acting administrator held and the IP
 * the action came from, so every entry can be traced to the person and place
 * that performed it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->string('actor_role')->nullable()->after('actor');
            $table->string('ip_address', 45)->nullable()->after('actor_role');
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->dropColumn(['actor_role', 'ip_address']);
        });
    }
};
