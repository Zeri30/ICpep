<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Membership fee payment.
 *
 * Stored as a nullable timestamp rather than a boolean + separate date: the
 * timestamp is both the status and the record of when it was paid (null =
 * unpaid), so the two can never contradict each other.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('paid_at')->nullable()->after('picture_path');

            // The dashboard counts paid members on every poll.
            $table->index('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex(['paid_at']);
            $table->dropColumn('paid_at');
        });
    }
};
