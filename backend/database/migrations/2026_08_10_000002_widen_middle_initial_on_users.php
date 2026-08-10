<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The admin account form now accepts up to 2 characters for a middle
 * initial (matching the public registration form), but the column was
 * created as varchar(1) — widen it so a 2-char value doesn't get truncated
 * or rejected by the database itself. Mirrors
 * 2026_08_08_000001_widen_middle_initial_on_applications.php exactly.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE users ALTER COLUMN middle_initial TYPE VARCHAR(2)');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE users ALTER COLUMN middle_initial TYPE VARCHAR(1)');
    }
};
