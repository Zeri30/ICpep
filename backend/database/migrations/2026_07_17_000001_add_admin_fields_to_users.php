<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the single-admin `users` table into a managed set of administrator
 * accounts. Every row here is (and always was) an officer account — the public
 * membership lives in `applications`, not `users` — so access to the admin is
 * now "an active account", refined by a role.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('username')->nullable()->unique()->after('name');
            $table->string('role')->default('admin')->after('password');
            $table->boolean('is_active')->default(true)->after('role');
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });

        // Backfill a username for any account that predates this column so the
        // uniqueness constraint and the UI both have something to show.
        DB::table('users')->whereNull('username')->orderBy('id')->get()->each(function ($user): void {
            $base = strtok((string) $user->email, '@') ?: 'admin';
            $username = $base;
            $n = 1;
            while (DB::table('users')->where('username', $username)->exists()) {
                $username = $base.++$n;
            }
            DB::table('users')->where('id', $user->id)->update(['username' => $username]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['username', 'role', 'is_active', 'last_login_at']);
        });
    }
};
