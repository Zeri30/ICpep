<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Record the acting officer's name and role alongside their email, mirroring
 * activity_logs' actor_name/actor_role (see
 * 2026_07_19_000004_add_actor_name_to_activity_logs.php and
 * 2026_07_17_000003_add_actor_role_and_ip_to_activity_logs.php). The ledger is
 * read by every officer for transparency, and "Juan Dela Cruz — Treasurer"
 * identifies who recorded a payment far faster than an email address does.
 *
 * Existing rows are backfilled from the accounts that match their recorded
 * email, using each account's *current* role — the best available guess,
 * since (like the activity log before it) no historical role was captured.
 * Anything unmatched (deleted accounts, seeded rows with no actor) keeps
 * null and falls back to the email when displayed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->string('actor_name')->nullable()->after('actor');
            $table->string('actor_role')->nullable()->after('actor_name');
        });

        // Chunked and matched in PHP rather than a correlated subquery, so the
        // backfill behaves the same on SQLite, MySQL and Postgres.
        User::query()->select('email', 'name', 'role')->chunk(200, function ($users): void {
            foreach ($users as $user) {
                DB::table('payment_transactions')
                    ->where('actor', $user->email)
                    ->whereNull('actor_name')
                    ->update([
                        'actor_name' => $user->name,
                        'actor_role' => $user->role?->value,
                    ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->dropColumn(['actor_name', 'actor_role']);
        });
    }
};
