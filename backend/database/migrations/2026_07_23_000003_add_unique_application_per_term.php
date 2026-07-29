<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Database-level safety net against duplicate membership applications: one active
 * application per email address within a membership list. Enforced here so it
 * cannot be bypassed by page refreshes, multiple browser tabs, or direct API
 * posts — the ApplicationController's friendly pre-check sits on top of this.
 *
 * The index is partial (Postgres) and keyed on the lower-cased email, so:
 *   - it ignores soft-deleted rows (a removed member can re-apply), and
 *   - "Juan@x.com" and "juan@x.com" count as the same person.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Clear the way for the constraint: if any list already holds two active
        // applications for one email, keep the earliest and soft-delete the rest
        // (recoverable from the Deleted tab) rather than fail the migration.
        $duplicates = DB::table('applications')
            ->selectRaw('membership_term_id, lower(email) as email_key, min(id) as keep_id')
            ->whereNull('deleted_at')
            ->groupBy('membership_term_id', DB::raw('lower(email)'))
            ->havingRaw('count(*) > 1')
            ->get();

        foreach ($duplicates as $group) {
            DB::table('applications')
                ->where('membership_term_id', $group->membership_term_id)
                ->whereRaw('lower(email) = ?', [$group->email_key])
                ->whereNull('deleted_at')
                ->where('id', '!=', $group->keep_id)
                ->update(['deleted_at' => now()]);
        }

        DB::statement(
            'CREATE UNIQUE INDEX applications_term_email_active_unique '
            .'ON applications (membership_term_id, lower(email)) '
            .'WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS applications_term_email_active_unique');
    }
};
