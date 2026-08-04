<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Payment History filter now narrows by payment batch (`kind`) alongside
 * `action` — same reasoning as `action`'s own index (see
 * 2026_07_16_000002_create_payment_transactions_table): no measured
 * slowness yet, but a seq scan is what Postgres falls back to without one as
 * the ledger grows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->index('kind');
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropIndex(['kind']);
        });
    }
};
