<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The public registration form now accepts up to 2 characters for a middle
 * initial, but the column was created as varchar(1) — widen it so a 2-char
 * value doesn't get truncated or rejected by the database itself.
 *
 * Raw SQL rather than Schema::table()->change(): that requires doctrine/dbal,
 * which this project doesn't have installed. SQLite (the test suite's
 * driver) doesn't enforce varchar length at all, so there is nothing to
 * widen there — the ALTER is skipped rather than attempted with Postgres-only
 * syntax.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE applications ALTER COLUMN middle_initial TYPE VARCHAR(2)');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE applications ALTER COLUMN middle_initial TYPE VARCHAR(1)');
    }
};
