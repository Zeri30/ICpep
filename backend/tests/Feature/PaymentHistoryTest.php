<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\PaymentTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PaymentHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function member(array $attributes = []): Application
    {
        return Application::create(array_merge([
            'surname' => 'Dela Cruz',
            'given_name' => 'Juan',
            'middle_initial' => 'S',
            'year_level' => '3rd Year',
            'section' => 'Section A',
            'birthday' => '2005-01-01',
            'address' => '1 Rizal St., Bulacan',
            'email' => 'juan'.fake()->unique()->numberBetween(1, 99999).'@example.test',
            'phone' => '0917 000 0000',
            'signature_path' => 'signatures/x.jpg',
            'picture_path' => 'pictures/x.jpg',
        ], $attributes));
    }

    public function test_marking_paid_records_a_transaction(): void
    {
        $member = $this->member();

        $member->update(['paid_at' => now()]);

        $tx = $member->paymentTransactions()->sole();
        $this->assertSame(PaymentTransaction::PAID, $tx->action);
        $this->assertSame(config('icpep.membership_fee'), (float) $tx->amount);
        $this->assertSame($member->full_name, $tx->member_name);
        $this->assertSame('Section A', $tx->section);
    }

    public function test_revoking_records_a_negative_transaction_against_the_original_date(): void
    {
        $paidOn = Carbon::now()->subDays(10);
        $member = $this->member(['paid_at' => $paidOn]);
        $member->paymentTransactions()->delete();

        $member->update(['paid_at' => null]);

        $tx = $member->paymentTransactions()->sole();
        $this->assertSame(PaymentTransaction::REVOKED, $tx->action);
        $this->assertSame(-1 * config('icpep.membership_fee'), (float) $tx->amount);
        // The reversal must land in the period it cancels, not the period it was
        // entered in, or a past month keeps counting money that was given back.
        $this->assertTrue($tx->effective_at->isSameDay($paidOn));
        $this->assertTrue($tx->created_at->isToday());
    }

    public function test_changing_the_payment_date_records_an_adjustment_and_moves_no_money(): void
    {
        $member = $this->member(['paid_at' => Carbon::now()]);
        $member->paymentTransactions()->delete();

        $member->update(['paid_at' => Carbon::now()->subDays(3)]);

        $tx = $member->paymentTransactions()->sole();
        $this->assertSame(PaymentTransaction::ADJUSTED, $tx->action);
        $this->assertSame(0.0, (float) $tx->amount);
        $this->assertNotNull($tx->previous_effective_at);
        $this->assertStringContainsString('Payment date changed', $tx->note);
    }

    public function test_the_audit_trail_outlives_the_payment(): void
    {
        $member = $this->member();

        $member->update(['paid_at' => now()]);
        $member->update(['paid_at' => now()->subDay()]);
        $member->update(['paid_at' => null]);

        $this->assertSame(
            ['paid', 'adjusted', 'revoked'],
            $member->paymentTransactions()->orderBy('id')->pluck('action')->all(),
        );
        // The member is unpaid, but the history of the payment survives.
        $this->assertNull($member->fresh()->paid_at);
    }

    public function test_period_totals_follow_the_members_current_state(): void
    {
        $fee = (float) config('icpep.membership_fee');
        $collected = fn (Carbon $from, Carbon $until): float => Application::query()
            ->whereBetween('paid_at', [$from, $until])->count() * $fee;
        $today = fn (): float => $collected(Carbon::today()->startOfDay(), Carbon::today()->endOfDay());

        $member = $this->member();
        $this->assertSame(0.0, $today());

        $member->update(['paid_at' => now()]);
        $this->assertSame($fee, $today());

        // Back-dating must move the fee out of today, which a running sum over
        // signed ledger rows would not do.
        $member->update(['paid_at' => now()->subDays(3)]);
        $this->assertSame(0.0, $today());

        $member->update(['paid_at' => null]);
        $this->assertSame(0.0, $today());
    }

    public function test_migration_backfills_members_paid_before_the_ledger_existed(): void
    {
        // Simulate a member paid while no ledger existed: write paid_at directly
        // and drop the table, then re-run the migration that creates it.
        $member = $this->member();
        DB::table('applications')->where('id', $member->id)->update(['paid_at' => now()->subMonth()]);
        DB::statement('DROP TABLE payment_transactions');

        (require database_path('migrations/2026_07_16_000002_create_payment_transactions_table.php'))->up();

        $tx = PaymentTransaction::where('application_id', $member->id)->sole();
        $this->assertSame(PaymentTransaction::PAID, $tx->action);
        $this->assertSame(config('icpep.membership_fee'), (float) $tx->amount);
        $this->assertStringContainsString('Opening balance', $tx->note);
        $this->assertTrue($tx->effective_at->isSameDay(now()->subMonth()));
    }

    public function test_members_who_never_paid_are_not_backfilled(): void
    {
        $this->member(); // unpaid
        DB::statement('DROP TABLE payment_transactions');

        (require database_path('migrations/2026_07_16_000002_create_payment_transactions_table.php'))->up();

        $this->assertSame(0, PaymentTransaction::count());
    }
}
