<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Which of the two payment batches a ledger row describes — see
 * App\Models\PaymentTransaction::PAYMENT_1 / PAYMENT_2. Every existing row
 * predates the two-batch split, so it was necessarily the (only) first batch.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->string('kind')->default('payment1')->after('action');
        });

        DB::table('payment_transactions')->update(['kind' => 'payment1']);
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
