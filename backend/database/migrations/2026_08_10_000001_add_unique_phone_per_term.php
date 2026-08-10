<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Closes the last gap in the term-scoped duplicate check: phone had no
 * uniqueness protection at all (unlike email and student ID below), so a
 * race between two submissions sharing a phone number could still land two
 * active rows even with ApplicationController::alreadyApplied() now
 * checking it. Mirrors 2026_07_23_000003_add_unique_application_per_term.php
 * exactly — partial (Postgres), so soft-deleted rows and other terms don't
 * collide with an active one.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Clear the way for the constraint: if any list already holds two active
        // applications for one phone number, keep the earliest and soft-delete
        // the rest (recoverable from the Deleted tab) rather than fail the
        // migration.
        $duplicates = DB::table('applications')
            ->selectRaw('membership_term_id, phone, min(id) as keep_id')
            ->whereNull('deleted_at')
            ->groupBy('membership_term_id', 'phone')
            ->havingRaw('count(*) > 1')
            ->get();

        foreach ($duplicates as $group) {
            DB::table('applications')
                ->where('membership_term_id', $group->membership_term_id)
                ->where('phone', $group->phone)
                ->whereNull('deleted_at')
                ->where('id', '!=', $group->keep_id)
                ->update(['deleted_at' => now()]);
        }

        DB::statement(
            'CREATE UNIQUE INDEX applications_term_phone_active_unique '
            .'ON applications (membership_term_id, phone) '
            .'WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS applications_term_phone_active_unique');
    }
};
