<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drop the ledger's free-text note.
 *
 * Every note the system wrote was a restatement of data already on the row —
 * the adjustment note repeated the two dates in `previous_effective_at` and
 * `effective_at`, and the backfill note repeated what a null actor already
 * implies. Nothing read it but the table, and it earned a column there that a
 * useful field could have had.
 *
 * Irreversible by design: down() restores the column but not its contents,
 * because the text was derived and can be re-derived from the dates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->dropColumn('note');
        });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->string('note')->nullable();
        });
    }
};
