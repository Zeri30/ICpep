<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Record the acting officer's name alongside their email.
 *
 * The log is read by people, and "Juan Dela Cruz — Secretary" identifies an
 * actor far faster than an address does. It is stored rather than joined so an
 * entry still names who acted after that account is renamed or deleted, which
 * is the whole point of an audit trail.
 *
 * Existing rows are backfilled from the accounts that match their recorded
 * email; anything unmatched (deleted accounts, the "Website" pseudo-actor)
 * keeps a null name and falls back to the email when displayed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->string('actor_name')->nullable()->after('actor');
        });

        // Chunked and matched in PHP rather than a correlated subquery, so the
        // backfill behaves the same on SQLite, MySQL and Postgres.
        User::query()->select('email', 'name')->chunk(200, function ($users): void {
            foreach ($users as $user) {
                DB::table('activity_logs')
                    ->where('actor', $user->email)
                    ->whereNull('actor_name')
                    ->update(['actor_name' => $user->name]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('activity_logs', function (Blueprint $table): void {
            $table->dropColumn('actor_name');
        });
    }
};
