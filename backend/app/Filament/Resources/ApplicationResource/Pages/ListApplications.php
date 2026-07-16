<?php

namespace App\Filament\Resources\ApplicationResource\Pages;

use App\Filament\Resources\ApplicationResource;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

class ListApplications extends ListRecords
{
    protected static string $resource = ApplicationResource::class;

    protected static ?string $title = 'Members List';

    // Active members only (soft-deleted records live under the "Deleted" nav item).

    protected function getHeaderActions(): array
    {
        return [
            // Marks everyone the current filters (and search) are showing as
            // paid in one click — the treasurer's shortcut for a section that
            // has already settled, instead of ticking each member. Works over
            // the filtered query, not row selection, so no rows need choosing.
            Actions\Action::make('mark_all_paid')
                ->label('Mark all as paid')
                ->icon('heroicon-o-banknotes')
                ->color('success')
                ->requiresConfirmation()
                ->modalHeading('Mark all filtered members as paid')
                ->modalDescription(function (): string {
                    $unpaid = $this->unpaidInView();

                    if ($unpaid === 0) {
                        return 'Every member matching the current filters is already paid — nothing to update.';
                    }

                    $fee = config('icpep.currency_symbol').number_format((float) config('icpep.membership_fee'), 0);

                    return "This marks the {$unpaid} member(s) shown by your current filters as paid, recording "
                        ."today as the payment date and adding {$fee} each to the revenue total. Members already "
                        .'paid keep their original date.';
                })
                ->modalSubmitActionLabel('Mark all as paid')
                ->action(function (): void {
                    // Only the unpaid ones change, so a bulk run never rewrites a
                    // date already on record. Iterate models (not a mass update)
                    // so each change still fires its activity-log event.
                    $members = $this->getFilteredTableQuery()->whereNull('paid_at')->get();
                    $count = $members->count();

                    if ($count === 0) {
                        Notification::make()
                            ->title('Nothing to update')
                            ->body('All filtered members are already marked as paid.')
                            ->info()
                            ->send();

                        return;
                    }

                    $members->each->update(['paid_at' => now()]);

                    Notification::make()
                        ->title('All filtered members marked as paid')
                        ->body($count.' member(s) marked as paid.')
                        ->success()
                        ->send();
                }),
        ];
    }

    /** How many members the table is currently showing still owe the fee. */
    protected function unpaidInView(): int
    {
        return $this->getFilteredTableQuery()->whereNull('paid_at')->count();
    }
}
