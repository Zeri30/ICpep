<?php

namespace App\Filament\Resources\ApplicationResource\Pages;

use App\Filament\Resources\ApplicationResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewApplication extends ViewRecord
{
    protected static string $resource = ApplicationResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),
            Actions\DeleteAction::make()
                ->label('Delete')
                ->modalHeading('Delete member')
                ->modalDescription('This removes the member from the list. The record is kept in the database (soft delete) and can be undone from the "Deleted members" filter.')
                ->successRedirectUrl(ApplicationResource::getUrl('index')),
            Actions\RestoreAction::make()
                ->label('Undo delete')
                ->icon('heroicon-o-arrow-uturn-left')
                ->requiresConfirmation()
                ->modalHeading('Restore member')
                ->modalDescription('Restore this member back to the members list?'),
        ];
    }
}
