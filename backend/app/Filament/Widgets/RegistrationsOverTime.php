<?php

namespace App\Filament\Widgets;

use App\Models\Application;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class RegistrationsOverTime extends ChartWidget
{
    protected static ?string $heading = 'Registrations over time';

    protected static ?string $description = 'New members per month (last 6 months).';

    protected static ?int $sort = 3;

    protected static ?string $pollingInterval = '30s';

    protected function getData(): array
    {
        // Build six monthly buckets in PHP so the query stays database-agnostic
        // (works the same on Postgres in production and sqlite in tests).
        $months = collect(range(5, 0))->map(
            fn (int $i): Carbon => now()->startOfMonth()->subMonths($i)
        );

        $counts = $months->map(
            fn (Carbon $month): int => Application::whereBetween('created_at', [
                $month->copy()->startOfMonth(),
                $month->copy()->endOfMonth(),
            ])->count()
        );

        return [
            'datasets' => [
                [
                    'label' => 'New members',
                    'data' => $counts->all(),
                    'borderColor' => '#dc2626',
                    'backgroundColor' => 'rgba(220, 38, 38, 0.15)',
                    'fill' => true,
                    'tension' => 0.3,
                ],
            ],
            'labels' => $months->map(fn (Carbon $m): string => $m->format('M Y'))->all(),
        ];
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => ['legend' => ['display' => false]],
            'scales' => ['y' => ['beginAtZero' => true, 'ticks' => ['precision' => 0]]],
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }
}
