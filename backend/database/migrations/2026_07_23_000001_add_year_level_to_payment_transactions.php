<?php

use App\Models\PaymentTransaction;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Denormalise the member's year level onto each ledger row, the same way
 * member_name and section already are: the Payment History screen shows it as a
 * column, and copying it keeps the row readable after the member is renamed or
 * force-deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->string('year_level')->nullable()->after('section');
        });

        // Backfill from the live member record where it still exists.
        PaymentTransaction::query()
            ->whereNull('year_level')
            ->with('application')
            ->chunkById(200, function ($rows): void {
                foreach ($rows as $row) {
                    if ($row->application) {
                        $row->forceFill(['year_level' => $row->application->year_level])->saveQuietly();
                    }
                }
            });
    }

    public function down(): void
    {
        Schema::table('payment_transactions', function (Blueprint $table): void {
            $table->dropColumn('year_level');
        });
    }
};
