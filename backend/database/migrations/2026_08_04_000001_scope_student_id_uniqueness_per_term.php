<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Student ID was made globally unique in 2026_07_29_000001, which — unlike
 * email (2026_07_23_000003) — silently blocked a returning student from ever
 * registering again in a later term. That contradicts the membership model
 * documented on Application: each term is an independent list a member
 * re-applies to every semester.
 *
 * This replaces the global unique with the same shape as the email index: one
 * active application per student ID *within a list*, freeing the ID up again
 * the moment that term is no longer current. No cleanup pass is needed here
 * (unlike the email migration) — the global unique constraint being replaced
 * already guarantees no two rows share a student_id today.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropUnique(['student_id']);

            // Backs "does this student ID already have a file on record in any
            // term" (ApplicationController::store), independent of the
            // per-term uniqueness below.
            $table->index('student_id');
        });

        DB::statement(
            'CREATE UNIQUE INDEX applications_term_student_id_active_unique '
            .'ON applications (membership_term_id, student_id) '
            .'WHERE deleted_at IS NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS applications_term_student_id_active_unique');

        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex(['student_id']);
            $table->unique('student_id');
        });
    }
};
