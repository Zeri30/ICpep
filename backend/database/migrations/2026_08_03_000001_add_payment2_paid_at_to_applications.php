<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The flat ₱75 fee is now collected in two sequential batches (₱50 then ₱25).
 * `paid_at` keeps its column name but now specifically means "Payment 1 paid
 * at" — `payment2_paid_at` is its counterpart, same nullable-timestamp-as-
 * status-and-date design (see 2026_07_16_000001_add_paid_at_to_applications).
 *
 * Backfill: a member who already has `paid_at` set already paid the full
 * ₱75 under the old flat-fee system — marking them as still owing the ₱25
 * batch would misreport a real billing history, so they are backfilled as
 * having completed both.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('payment2_paid_at')->nullable()->after('paid_at');
            $table->index('payment2_paid_at');
        });

        DB::table('applications')
            ->whereNotNull('paid_at')
            ->update(['payment2_paid_at' => DB::raw('paid_at')]);
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex(['payment2_paid_at']);
            $table->dropColumn('payment2_paid_at');
        });
    }
};
