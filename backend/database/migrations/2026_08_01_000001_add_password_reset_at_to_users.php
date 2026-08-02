<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Backs the reset-password cooldown: UserController::resetPassword refuses to
 * run again for the same account within 7 days of this timestamp, so an
 * account can't be reset back-to-back (accidentally or as harassment) by
 * whoever holds the manage-users permission.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('password_reset_at')->nullable()->after('must_change_password');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_reset_at');
        });
    }
};
