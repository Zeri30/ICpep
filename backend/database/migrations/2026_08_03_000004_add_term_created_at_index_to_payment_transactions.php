<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Every Payment History request narrows to one term first (`forTerm`), then
 * sorts by `created_at` (the ledger has no other order) — the same shape
 * 2026_07_30_132039_add_performance_indexes_to_applications already covers for
 * the Members List. `membership_term_id` was indexed alone (see
 * 2026_08_02_000002_add_class_index_to_payment_transactions), which still
 * needs a separate sort step; this composite covers the narrow-then-order in
 * one pass instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->index(['membership_term_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropIndex(['membership_term_id', 'created_at']);
        });
    }
};
