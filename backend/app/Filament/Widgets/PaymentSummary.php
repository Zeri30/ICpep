<?php

namespace App\Filament\Widgets;

use App\Models\Application;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;

/**
 * Membership fees collected today / this week / this month, shown above the
 * payment history.
 *
 * Derived from applications.paid_at rather than summed from the ledger: a
 * revoked payment simply stops being counted, and a corrected date moves the fee
 * between periods on its own. Summing signed ledger rows would only match this
 * if every correction wrote a perfectly paired reversal.
 */
class PaymentSummary extends BaseWidget
{
    /** Sits under the headline stats, above the charts. */
    protected static ?int $sort = 2;

    protected static ?string $pollingInterval = '30s';

    protected int|string|array $columnSpan = 'full';

    protected function getColumns(): int
    {
        return 3;
    }

    protected function getStats(): array
    {
        $fee = (float) config('icpep.membership_fee');
        $symbol = config('icpep.currency_symbol');

        $countBetween = fn (Carbon $from, Carbon $until): int => Application::query()
            ->whereBetween('paid_at', [$from, $until])
            ->count();

        $today = $countBetween(Carbon::today()->startOfDay(), Carbon::today()->endOfDay());
        // startOfWeek/endOfWeek follow the app locale's first day of week.
        $week = $countBetween(Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek());
        $month = $countBetween(Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth());

        $money = fn (int $count): string => $symbol.number_format($count * $fee, 2);
        $members = fn (int $count): string => $count.' '.str('member')->plural($count);

        return [
            Stat::make('Collected today', $money($today))
                ->description($members($today).' · '.Carbon::today()->format('M j, Y'))
                ->descriptionIcon('heroicon-m-banknotes')
                ->color($today > 0 ? 'success' : 'gray'),

            Stat::make('This week', $money($week))
                ->description(
                    $members($week).' · '
                    .Carbon::now()->startOfWeek()->format('M j').' – '
                    .Carbon::now()->endOfWeek()->format('M j')
                )
                ->descriptionIcon('heroicon-m-calendar-days')
                ->color($week > 0 ? 'success' : 'gray'),

            Stat::make('This month', $money($month))
                ->description($members($month).' · '.Carbon::now()->format('F Y'))
                ->descriptionIcon('heroicon-m-calendar')
                ->color($month > 0 ? 'success' : 'gray'),
        ];
    }
}
