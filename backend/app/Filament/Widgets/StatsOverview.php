<?php

namespace App\Filament\Widgets;

use App\Models\Application;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = 1;

    /** Auto-refresh so the numbers stay live as students register. */
    protected static ?string $pollingInterval = '10s';

    protected function getStats(): array
    {
        $fee = (float) config('icpep.membership_fee');
        $symbol = config('icpep.currency_symbol');

        // "Live" = current members, excluding deleted (soft-deleted) ones.
        $live = Application::count();
        $thirdYear = Application::where('year_level', '3rd Year')->count();
        $fourthYear = Application::where('year_level', '4th Year')->count();

        // Derived from who has actually paid, never accumulated. Marking a member
        // paid adds one fee here and unmarking removes it, with no stored total
        // that could drift out of step with the members list.
        $paid = Application::paid()->count();
        $unpaid = $live - $paid;
        $collected = $paid * $fee;

        return [
            Stat::make('Members', $live)
                ->description('registered members')
                ->descriptionIcon('heroicon-m-user-group')
                ->color('primary'),
            Stat::make('3rd Year', $thirdYear)
                ->description('members')
                ->descriptionIcon('heroicon-m-academic-cap')
                ->color('info'),
            Stat::make('4th Year', $fourthYear)
                ->description('members')
                ->descriptionIcon('heroicon-m-academic-cap')
                ->color('info'),
            Stat::make('Revenue collected', $symbol.number_format($collected, 2))
                ->description(
                    $paid.' of '.$live.' paid'
                    .($unpaid > 0 ? ' · '.$unpaid.' pending '.$symbol.number_format($unpaid * $fee, 0) : '')
                )
                ->descriptionIcon('heroicon-m-banknotes')
                ->color($unpaid > 0 ? 'warning' : 'success'),
        ];
    }
}
