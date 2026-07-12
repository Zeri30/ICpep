<?php

namespace App\Filament\Widgets;

use App\Models\Application;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    /** Auto-refresh so the numbers stay live as students register. */
    protected static ?string $pollingInterval = '10s';

    protected function getStats(): array
    {
        $fee = (float) config('icpep.membership_fee');
        $symbol = config('icpep.currency_symbol');

        // "Live" = current registrations, excluding deleted (soft-deleted) ones.
        $live = Application::count();
        $pending = Application::where('status', 'pending')->count();
        $thirdYear = Application::where('year_level', '3rd Year')->count();
        $fourthYear = Application::where('year_level', '4th Year')->count();
        $revenue = $live * $fee;

        return [
            Stat::make('Registrations (live)', $live)
                ->description($pending.' awaiting review')
                ->descriptionIcon('heroicon-m-clock')
                ->color('primary'),
            Stat::make('3rd Year', $thirdYear)
                ->description('applicants')
                ->descriptionIcon('heroicon-m-academic-cap')
                ->color('info'),
            Stat::make('4th Year', $fourthYear)
                ->description('applicants')
                ->descriptionIcon('heroicon-m-academic-cap')
                ->color('info'),
            Stat::make('Expected revenue', $symbol.number_format($revenue, 2))
                ->description($symbol.number_format($fee, 0).' × '.$live.' registrations')
                ->descriptionIcon('heroicon-m-banknotes')
                ->color('success'),
        ];
    }
}
