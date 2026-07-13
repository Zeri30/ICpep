<?php

namespace App\Filament\Resources;

use App\Filament\Resources\ApplicationResource\Pages;
use App\Models\Application;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Infolists\Components\ImageEntry;
use Filament\Infolists\Components\Section as InfoSection;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ApplicationResource extends Resource
{
    protected static ?string $model = Application::class;

    protected static ?string $navigationIcon = 'heroicon-o-user-group';

    /** Every submitted form is a registered member, so this is the Members List. */
    protected static ?string $navigationLabel = 'Members List';

    protected static ?string $modelLabel = 'member';

    protected static ?string $pluralModelLabel = 'members';

    protected static ?int $navigationSort = 1;

    /** Year levels / sections offered on the public membership form. */
    protected const YEAR_LEVELS = ['3rd Year', '4th Year'];

    protected const SECTIONS = ['Section A', 'Section B'];

    /** Combined "Year & Section" options (e.g. 3A) → [year_level, section]. */
    protected const CLASS_MAP = [
        '3A' => ['3rd Year', 'Section A'],
        '3B' => ['3rd Year', 'Section B'],
        '4A' => ['4th Year', 'Section A'],
        '4B' => ['4th Year', 'Section B'],
    ];

    /** Members are created by the public website form, never in the admin. */
    public static function canCreate(): bool
    {
        return false;
    }

    /** Live member count shown as a badge on the sidebar item. */
    public static function getNavigationBadge(): ?string
    {
        return (string) static::getModel()::count();
    }

    /** Signed, short-lived URL for viewing a private file in the Supabase bucket. */
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

    /**
     * Stream a private file to the admin as a download (attachment), so it can be
     * saved locally for use outside the system.
     */
    protected static function downloadFile(Application $record, string $which): ?StreamedResponse
    {
        $path = $which === 'picture' ? $record->picture_path : $record->signature_path;

        if (! $path) {
            return null;
        }

        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $name = str($record->full_name)->slug('_')."_{$which}".($ext ? ".{$ext}" : '');

        try {
            return Storage::disk('supabase')->download($path, $name);
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Section::make('Member details')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('surname')
                            ->required()
                            ->maxLength(100),
                        Forms\Components\TextInput::make('given_name')
                            ->label('Given name')
                            ->required()
                            ->maxLength(100),
                        Forms\Components\TextInput::make('middle_initial')
                            ->label('Middle initial')
                            ->maxLength(1),
                        Forms\Components\DatePicker::make('birthday')
                            ->native(false)
                            ->required(),
                        Forms\Components\Select::make('year_level')
                            ->label('Year level')
                            ->options(array_combine(self::YEAR_LEVELS, self::YEAR_LEVELS))
                            ->required(),
                        Forms\Components\Select::make('section')
                            ->options(array_combine(self::SECTIONS, self::SECTIONS))
                            ->required(),
                        Forms\Components\TextInput::make('email')
                            ->email()
                            ->required()
                            ->maxLength(150),
                        Forms\Components\TextInput::make('phone')
                            ->tel()
                            ->required()
                            ->maxLength(30),
                        Forms\Components\Textarea::make('address')
                            ->required()
                            ->rows(2)
                            ->columnSpanFull(),
                    ]),
            ]);
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
                TextColumn::make('class_code')
                    ->label('Class')
                    ->badge()
                    ->color('primary')
                    ->tooltip(fn (Application $record): string => "{$record->year_level} · {$record->section}"),
                TextColumn::make('year_level')
                    ->label('Year')
                    ->badge()
                    ->color('gray')
                    ->toggleable(),
                TextColumn::make('section')
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('phone')
                    ->label('Phone')
                    ->toggleable(),
                TextColumn::make('created_at')
                    ->label('Registered')
                    ->dateTime('M j, Y g:i A')
                    ->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('class')
                    ->label('Year & Section')
                    ->options(array_combine(array_keys(self::CLASS_MAP), array_keys(self::CLASS_MAP)))
                    ->query(function (Builder $query, array $data): Builder {
                        $value = $data['value'] ?? null;
                        if (! $value || ! isset(self::CLASS_MAP[$value])) {
                            return $query;
                        }
                        [$year, $section] = self::CLASS_MAP[$value];

                        return $query->where('year_level', $year)->where('section', $section);
                    }),
                Tables\Filters\TrashedFilter::make()
                    ->label('Deleted members')
                    ->placeholder('Active members')
                    ->trueLabel('With deleted')
                    ->falseLabel('Only deleted'),
            ])
            ->actions([
                // Standalone (not in the ⋯ menu) so it's easy to reach; only
                // shows on soft-deleted rows.
                Tables\Actions\RestoreAction::make()
                    ->label('Undo delete')
                    ->iconButton()
                    ->tooltip('Undo delete')
                    ->color('success')
                    ->icon('heroicon-o-arrow-uturn-left')
                    ->requiresConfirmation()
                    ->modalHeading('Restore member')
                    ->modalDescription(fn (Application $record): string => "Restore {$record->full_name} back to the members list?"),
                Tables\Actions\ActionGroup::make([
                    Tables\Actions\ViewAction::make(),
                    Tables\Actions\EditAction::make(),
                    Tables\Actions\Action::make('download_picture')
                        ->label('Download photo')
                        ->icon('heroicon-o-arrow-down-tray')
                        ->color('gray')
                        ->action(fn (Application $record) => static::downloadFile($record, 'picture'))
                        ->visible(fn (Application $record): bool => (bool) $record->picture_path),
                    Tables\Actions\Action::make('download_signature')
                        ->label('Download signature')
                        ->icon('heroicon-o-arrow-down-tray')
                        ->color('gray')
                        ->action(fn (Application $record) => static::downloadFile($record, 'signature'))
                        ->visible(fn (Application $record): bool => (bool) $record->signature_path),
                    Tables\Actions\Action::make('signature')
                        ->label('Open signature')
                        ->icon('heroicon-o-pencil-square')
                        ->color('gray')
                        ->url(fn (Application $record): ?string => static::fileUrl($record->signature_path))
                        ->openUrlInNewTab()
                        ->visible(fn (Application $record): bool => (bool) static::fileUrl($record->signature_path)),
                    Tables\Actions\DeleteAction::make()
                        ->label('Delete')
                        ->modalHeading('Delete member')
                        ->modalDescription('This removes the member from the list. The record is kept in the database (soft delete) and can be undone from the "Deleted members" filter.'),
                ]),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make()
                        ->label('Delete'),
                    Tables\Actions\RestoreBulkAction::make()
                        ->label('Undo delete')
                        ->requiresConfirmation()
                        ->modalHeading('Restore members')
                        ->modalDescription('Restore the selected members back to the members list?'),
                ]),
            ]);
    }

    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist
            ->schema([
                InfoSection::make('Member')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('full_name')->label('Full name'),
                        TextEntry::make('class_code')
                            ->label('Class')
                            ->badge()
                            ->color('primary'),
                        TextEntry::make('year_level')->label('Year level'),
                        TextEntry::make('section'),
                        TextEntry::make('birthday')->date('F j, Y'),
                        TextEntry::make('created_at')->label('Registered')->dateTime('F j, Y g:i A'),
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
            'edit' => Pages\EditApplication::route('/{record}/edit'),
        ];
    }
}
