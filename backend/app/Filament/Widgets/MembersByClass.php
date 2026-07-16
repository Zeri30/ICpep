<?php

namespace App\Filament\Widgets;

use App\Models\Application;
use Filament\Widgets\ChartWidget;

class MembersByClass extends ChartWidget
{
    protected static ?string $heading = 'Members by year & section';

    protected static ?string $description = 'Live headcount per class (3A / 3B / 4A / 4B).';

    protected static ?int $sort = 3;

    protected static ?string $pollingInterval = '30s';

    protected function getData(): array
    {
        $counts = collect(Application::CLASS_MAP)->map(
            fn (array $c): int => Application::where('year_level', $c[0])
                ->where('section', $c[1])
                ->count()
        );

        return [
            'datasets' => [
                [
                    'label' => 'Members',
                    'data' => $counts->values()->all(),
                    'backgroundColor' => ['#dc2626', '#f59e0b', '#dc2626', '#f59e0b'],
                    'borderRadius' => 6,
                ],
            ],
            'labels' => array_keys(Application::CLASS_MAP),
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
        return 'bar';
    }
}
