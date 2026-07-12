<?php

namespace App\Filament\Resources\ApplicationResource\Pages;

use App\Filament\Resources\ApplicationResource;
use App\Models\Application;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewApplication extends ViewRecord
{
    protected static string $resource = ApplicationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\Action::make('approve')
                ->label('Approve')
                ->icon('heroicon-o-check-circle')
                ->color('success')
                ->requiresConfirmation()
                ->modalHeading('Approve application')
                ->modalDescription(fn (Application $record): string => "Mark {$record->full_name}'s application as approved?")
                ->action(fn (Application $record) => $record->update(['status' => 'approved']))
                ->visible(fn (Application $record): bool => $record->status !== 'approved'),
            Actions\Action::make('reject')
                ->label('Reject')
                ->icon('heroicon-o-x-circle')
                ->color('danger')
                ->requiresConfirmation()
                ->modalHeading('Reject application')
                ->modalDescription(fn (Application $record): string => "Mark {$record->full_name}'s application as rejected?")
                ->action(fn (Application $record) => $record->update(['status' => 'rejected']))
                ->visible(fn (Application $record): bool => $record->status !== 'rejected'),
            Actions\DeleteAction::make()
                ->modalHeading('Delete application')
                ->modalDescription('This permanently deletes the application and its uploaded files. This cannot be undone.'),
        ];
    }
}
