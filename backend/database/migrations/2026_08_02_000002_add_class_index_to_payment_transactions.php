<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Payment History filter now narrows on year_level + section together
 * (the same "3A".."4B" codes the Members List filters on — see
 * PaymentTransaction::scopeInClass), on top of the term scope every request
 * already applies. Neither combination had a matching index, so this mirrors
 * 2026_07_30_132039_add_performance_indexes_to_applications for the same
 * reason: no measured slowness yet, but a seq scan is what Postgres falls
 * back to without one as the ledger grows past a few hundred rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            // Every request filters on the term first, regardless of the other
            // filters or of search — covers that narrowing on its own.
            $table->index('membership_term_id');

            // The Year & Section filter always narrows on both together, never
            // year_level alone.
            $table->index(['year_level', 'section']);
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropIndex(['membership_term_id']);
            $table->dropIndex(['year_level', 'section']);
        });
    }
};
