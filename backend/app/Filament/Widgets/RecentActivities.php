<?php

namespace App\Filament\Widgets;

use App\Models\ActivityLog;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget as BaseWidget;

class RecentActivities extends BaseWidget
{
    protected static ?string $heading = 'Recent activity';

    protected int|string|array $columnSpan = 'full';

    protected static ?string $pollingInterval = '10s';

    protected static ?int $sort = 2;

    public function table(Table $table): Table
    {
        return $table
            ->query(ActivityLog::query()->latest())
            ->defaultPaginationPageOption(5)
            ->paginationPageOptions([5, 10, 25])
            ->columns([
                Tables\Columns\TextColumn::make('created_at')
                    ->label('When')
                    ->since()
                    ->tooltip(fn (ActivityLog $record): string => $record->created_at->format('M j, Y g:i A'))
                    ->sortable(),
                Tables\Columns\TextColumn::make('action')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved', 'restored' => 'success',
                        'rejected', 'force_deleted' => 'danger',
                        'deleted' => 'warning',
                        'registered' => 'info',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn (string $state): string => str($state)->replace('_', ' ')->title()),
                Tables\Columns\TextColumn::make('description')
                    ->wrap(),
                Tables\Columns\TextColumn::make('actor')
                    ->label('By')
                    ->toggleable(),
            ]);
    }
}
