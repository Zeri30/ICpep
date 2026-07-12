<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ApplicationResource\Pages;
use App\Models\Application;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\Section as InfoSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

class ApplicationResource extends Resource
{
    protected static ?string $model = Application::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    protected static ?string $navigationLabel = 'Membership Applications';

    protected static ?string $modelLabel = 'application';

    protected static ?string $pluralModelLabel = 'applications';

    /** Applications are created by the public website form, never in the admin. */
    public static function canCreate(): bool
    {
        return false;
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) static::getModel()::where('status', 'pending')->count();
    }

    /** Signed, short-lived URL for a private file in the Supabase bucket. */
    protected static function fileUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        try {
            return Storage::disk('supabase')->temporaryUrl($path, now()->addMinutes(10));
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                ImageColumn::make('picture_path')
                    ->label('Photo')
                    ->disk('supabase')
                    ->visibility('private')
                    ->checkFileExistence(false)
                    ->circular(),
                TextColumn::make('surname')
                    ->label('Name')
                    ->formatStateUsing(fn (Application $record): string => $record->full_name)
                    ->description(fn (Application $record): string => $record->email)
                    ->searchable(['surname', 'given_name'])
                    ->sortable(),
                TextColumn::make('year_level')
                    ->label('Year')
                    ->badge()
                    ->color('gray'),
                TextColumn::make('section')
                    ->sortable(),
                TextColumn::make('phone')
                    ->label('Phone')
                    ->toggleable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'approved' => 'success',
                        'rejected' => 'danger',
                        default => 'warning',
                    })
                    ->sortable(),
                TextColumn::make('created_at')
                    ->label('Submitted')
                    ->dateTime('M j, Y g:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                    ]),
            ])
            ->actions([
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\Action::make('approve')
                        ->label('Approve')
                        ->icon('heroicon-o-check-circle')
                        ->color('success')
                        ->requiresConfirmation()
                        ->modalHeading('Approve application')
                        ->modalDescription(fn (Application $record): string => "Mark {$record->full_name}'s application as approved?")
                        ->action(fn (Application $record) => $record->update(['status' => 'approved']))
                        ->visible(fn (Application $record): bool => ! $record->trashed() && $record->status !== 'approved'),
                    Tables\Actions\Action::make('reject')
                        ->label('Reject')
                        ->icon('heroicon-o-x-circle')
                        ->color('danger')
                        ->requiresConfirmation()
                        ->modalHeading('Reject application')
                        ->modalDescription(fn (Application $record): string => "Mark {$record->full_name}'s application as rejected?")
                        ->action(fn (Application $record) => $record->update(['status' => 'rejected']))
                        ->visible(fn (Application $record): bool => ! $record->trashed() && $record->status !== 'rejected'),
                    Tables\Actions\Action::make('signature')
                        ->label('Open signature')
                        ->icon('heroicon-o-pencil-square')
                        ->color('gray')
                        ->url(fn (Application $record): ?string => static::fileUrl($record->signature_path))
                        ->openUrlInNewTab()
                        ->visible(fn (Application $record): bool => (bool) static::fileUrl($record->signature_path)),
                    Tables\Actions\DeleteAction::make()
                        ->label('Move to Deleted')
                        ->modalHeading('Delete application')
                        ->modalDescription('This moves the application to the Deleted tab. You can restore it later, or permanently delete it from there.'),
                    Tables\Actions\RestoreAction::make()
                        ->modalHeading('Restore application'),
                    Tables\Actions\ForceDeleteAction::make()
                        ->modalHeading('Permanently delete')
                        ->modalDescription('This permanently deletes the application and its uploaded files. This cannot be undone.'),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->schema([
                InfoSection::make('Applicant')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('full_name')->label('Full name'),
                        TextEntry::make('status')
                            ->badge()
                            ->color(fn (string $state): string => match ($state) {
                                'approved' => 'success',
                                'rejected' => 'danger',
                                default => 'warning',
                            }),
                        TextEntry::make('year_level')->label('Year level'),
                        TextEntry::make('section'),
                        TextEntry::make('birthday')->date('F j, Y'),
                        TextEntry::make('created_at')->label('Submitted')->dateTime('F j, Y g:i A'),
                        TextEntry::make('email')->copyable()->icon('heroicon-o-envelope'),
                        TextEntry::make('phone')->copyable()->icon('heroicon-o-phone'),
                        TextEntry::make('address')->columnSpanFull(),
                    ]),
                InfoSection::make('Formal picture')
                    ->schema([
                        ImageEntry::make('picture_path')
                            ->hiddenLabel()
                            ->disk('supabase')
                            ->visibility('private')
                            ->checkFileExistence(false)
                            ->height(260),
                    ]),
                InfoSection::make('E-signature')
                    ->schema([
                        TextEntry::make('signature_path')
                            ->hiddenLabel()
                            ->formatStateUsing(fn (): string => 'Open e-signature file')
                            ->url(fn (Application $record): ?string => static::fileUrl($record->signature_path))
                            ->openUrlInNewTab()
                            ->color('primary')
                            ->icon('heroicon-o-arrow-top-right-on-square'),
                    ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListApplications::route('/'),
            'view' => Pages\ViewApplication::route('/{record}'),
        ];
    }
}
