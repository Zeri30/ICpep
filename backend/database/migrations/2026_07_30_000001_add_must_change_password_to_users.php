<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks an account as still carrying its system-generated first-login
 * password. Set on every new account the admin form creates; cleared the
 * moment the officer sets their own password (see MeController::updatePassword).
 *
 * Defaults false, so every account that already exists is left alone — this
 * only applies going forward, to accounts nobody has signed into yet.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('must_change_password')->default(false)->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('must_change_password');
        });
    }
};
