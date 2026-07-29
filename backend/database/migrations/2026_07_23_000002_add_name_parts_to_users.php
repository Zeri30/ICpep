<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Administrator accounts now capture the name in parts — first name, an optional
 * middle initial, and last name — rather than one free-text "Full Name". The
 * composed `name` column is kept (and written on every save) so everything that
 * displays an officer's name keeps working unchanged.
 *
 * `username` is retired from the account form; the column stays (nullable) so
 * historical values and the login fallback are undisturbed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('name');
            $table->string('middle_initial', 1)->nullable()->after('first_name');
            $table->string('last_name')->nullable()->after('middle_initial');
        });

        // Backfill the parts from the existing full name: first token → first
        // name, last token → last name, a single middle token → middle initial.
        DB::table('users')->orderBy('id')->get()->each(function ($user): void {
            $parts = preg_split('/\s+/', trim((string) $user->name)) ?: [];
            $parts = array_values(array_filter($parts, fn ($p): bool => $p !== ''));

            $first = array_shift($parts) ?? (string) $user->name;
            $last = count($parts) ? array_pop($parts) : '';
            $middle = count($parts) ? mb_substr($parts[0], 0, 1) : null;

            DB::table('users')->where('id', $user->id)->update([
                'first_name' => $first,
                'middle_initial' => $middle,
                'last_name' => $last,
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['first_name', 'middle_initial', 'last_name']);
        });
    }
};
