<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An append-only ledger of membership-fee events.
 *
 * applications.paid_at records the *current state* and cannot answer "was this
 * ever revoked, and when?" — revoking erases it. This table records each event
 * instead, so the history survives regardless of what the member row later says.
 *
 * `amount` is signed (+fee when paid, -fee when revoked, 0 for a date
 * correction), so a period's collected total is a SUM over the rows and nets
 * revocations out automatically.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();

            // Members are soft-deleted, so the row this points at stays readable.
            $table->foreignId('application_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('action');                    // paid | revoked | adjusted
            $table->decimal('amount', 10, 2)->default(0);

            // When the money changed hands (mirrors applications.paid_at).
            $table->timestamp('effective_at')->nullable();
            // What it was before an adjustment, so a correction is auditable.
            $table->timestamp('previous_effective_at')->nullable();

            $table->string('actor')->nullable();         // admin email, or null when seeded
            $table->string('member_name');               // denormalised: the ledger must
                                                         // stay readable if the member is
                                                         // force-deleted or renamed.
            $table->string('section')->nullable();       // snapshot, for filtering by section
            $table->string('note')->nullable();

            // created_at = when the event was recorded (distinct from effective_at).
            $table->timestamps();

            $table->index('action');
            $table->index('created_at');
            $table->index('effective_at');
        });

        $this->backfillExistingPayments();
    }

    /**
     * Members already marked paid were paid before this ledger existed, so they
     * would show as paid in the members list while having no payment history at
     * all. Give each one an opening row from their recorded paid_at, so the
     * history is complete from day one rather than starting with a silent gap.
     */
    private function backfillExistingPayments(): void
    {
        $fee = (float) config('icpep.membership_fee', 50);
        $now = now();

        DB::table('applications')
            ->whereNotNull('paid_at')
            ->orderBy('id')
            ->chunkById(100, function ($members) use ($fee, $now): void {
                $rows = [];

                foreach ($members as $m) {
                    $mi = $m->middle_initial ? ", {$m->middle_initial}." : '';

                    $rows[] = [
                        'application_id' => $m->id,
                        'action' => 'paid',
                        'amount' => $fee,
                        'effective_at' => $m->paid_at,
                        'previous_effective_at' => null,
                        'actor' => null,
                        'member_name' => "{$m->surname}, {$m->given_name}{$mi}",
                        'section' => $m->section,
                        'note' => 'Opening balance — recorded before the payment history existed.',
                        // Backdated to the payment itself; this row describes an
                        // event that already happened, not one happening now.
                        'created_at' => $m->paid_at ?? $now,
                        'updated_at' => $now,
                    ];
                }

                if ($rows) {
                    DB::table('payment_transactions')->insert($rows);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
