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
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
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
                // Field order and labels mirror the public membership form, so
                // an officer reading a record sees it the way the applicant
                // filled it in.
                Forms\Components\Section::make('Member details')
                    ->columns(2)
                    ->schema([
                        Forms\Components\TextInput::make('surname')
                            ->label('Surname')
                            ->required()
                            ->maxLength(100),
                        Forms\Components\TextInput::make('given_name')
                            ->label('Given Name')
                            ->required()
                            ->maxLength(100),
                        Forms\Components\TextInput::make('middle_initial')
                            ->label('Middle Initial')
                            ->helperText('Optional, as on the public form.')
                            ->maxLength(1),
                        Forms\Components\Select::make('year_level')
                            ->label('Year Level')
                            ->options(array_combine(self::YEAR_LEVELS, self::YEAR_LEVELS))
                            ->required(),
                        Forms\Components\Select::make('section')
                            ->label('Section')
                            ->options(array_combine(self::SECTIONS, self::SECTIONS))
                            ->required(),
                        Forms\Components\DatePicker::make('birthday')
                            ->label('Birthday')
                            ->native(false)
                            ->required(),
                        Forms\Components\Textarea::make('address')
                            ->label('Address')
                            ->required()
                            ->rows(2)
                            ->columnSpanFull(),
                        Forms\Components\TextInput::make('email')
                            ->label('Email')
                            ->email()
                            ->required()
                            ->maxLength(150),
                        Forms\Components\TextInput::make('phone')
                            ->label('Phone Number')
                            ->tel()
                            ->required()
                            ->maxLength(30),
                    ]),
                // Not part of the public form — this is the officers' record of
                // the ₱50 fee, and it drives the dashboard's revenue figure.
                Forms\Components\Section::make('Membership Fee')
                    ->columns(2)
                    ->schema([
                        Forms\Components\Toggle::make('is_paid')
                            ->label('Paid')
                            ->helperText(fn (): string => 'Adds '.config('icpep.currency_symbol')
                                .number_format((float) config('icpep.membership_fee'), 0).' to the revenue total.')
                            ->live()
                            // The toggle is a view over paid_at, which stays the
                            // single source of truth for status *and* date.
                            ->afterStateHydrated(fn (Forms\Components\Toggle $component, ?Application $record) => $component->state((bool) $record?->paid_at))
                            ->afterStateUpdated(function (bool $state, Forms\Set $set, ?Application $record): void {
                                // Keep the original date when re-ticking a member
                                // who was already paid, rather than stamping now.
                                $set('paid_at', $state ? ($record?->paid_at ?? now()) : null);
                            })
                            ->dehydrated(false),
                        Forms\Components\DateTimePicker::make('paid_at')
                            ->label('Date paid')
                            ->native(false)
                            ->maxDate(now())
                            ->placeholder('Not paid yet')
                            ->helperText('Back-date this if the fee was collected earlier.')
                            ->visible(fn (Forms\Get $get): bool => (bool) $get('is_paid')),
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
                TextColumn::make('paid_at')
                    ->label('Payment')
                    ->badge()
                    ->state(fn (Application $record): string => $record->is_paid ? 'Paid' : 'Unpaid')
                    ->color(fn (Application $record): string => $record->is_paid ? 'success' : 'gray')
                    ->icon(fn (Application $record): string => $record->is_paid ? 'heroicon-m-check-circle' : 'heroicon-m-clock')
                    ->tooltip(fn (Application $record): ?string => $record->paid_at?->format('M j, Y g:i A'))
                    ->sortable(),
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
                Tables\Filters\SelectFilter::make('payment')
                    ->label('Payment')
                    ->options([
                        'paid' => 'Paid',
                        'unpaid' => 'Unpaid',
                    ])
                    ->query(fn (Builder $query, array $data): Builder => match ($data['value'] ?? null) {
                        'paid' => $query->paid(),
                        'unpaid' => $query->unpaid(),
                        default => $query,
                    }),
                // Narrow the list to a specific span — e.g. everyone who
                // registered during an enrolment week, or who paid last month.
                Tables\Filters\Filter::make('date_range')
                    ->label('Date range')
                    ->form([
                        Forms\Components\Select::make('field')
                            ->label('Date field')
                            ->options([
                                'created_at' => 'Registered',
                                'paid_at' => 'Paid',
                                'birthday' => 'Birthday',
                            ])
                            ->default('created_at')
                            ->selectablePlaceholder(false),
                        Forms\Components\DatePicker::make('from')
                            ->label('From')
                            ->native(false)
                            ->maxDate(now()),
                        Forms\Components\DatePicker::make('until')
                            ->label('Until')
                            ->native(false)
                            ->maxDate(now()),
                    ])
                    ->query(function (Builder $query, array $data): Builder {
                        $field = in_array($data['field'] ?? null, ['created_at', 'paid_at', 'birthday'], true)
                            ? $data['field']
                            : 'created_at';

                        return $query
                            // whereDate keeps the bounds inclusive: a timestamp
                            // column compared against a bare date would other-
                            // wise drop everything after 00:00 on the end day.
                            ->when($data['from'] ?? null, fn (Builder $q, $date): Builder => $q->whereDate($field, '>=', $date))
                            ->when($data['until'] ?? null, fn (Builder $q, $date): Builder => $q->whereDate($field, '<=', $date));
                    })
                    ->indicateUsing(function (array $data): ?string {
                        if (blank($data['from'] ?? null) && blank($data['until'] ?? null)) {
                            return null;
                        }

                        $label = ['created_at' => 'Registered', 'paid_at' => 'Paid', 'birthday' => 'Birthday'][$data['field'] ?? 'created_at'] ?? 'Registered';
                        $from = filled($data['from'] ?? null) ? Carbon::parse($data['from'])->format('M j, Y') : null;
                        $until = filled($data['until'] ?? null) ? Carbon::parse($data['until'])->format('M j, Y') : null;

                        return match (true) {
                            $from && $until => "{$label}: {$from} – {$until}",
                            (bool) $from => "{$label}: from {$from}",
                            default => "{$label}: until {$until}",
                        };
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
                // Standalone: paying is the routine job, so it shouldn't be
                // buried a click deep in the ⋯ menu.
                Tables\Actions\Action::make('toggle_paid')
                    ->label(fn (Application $record): string => $record->is_paid ? 'Mark as unpaid' : 'Mark as paid')
                    ->tooltip(fn (Application $record): string => $record->is_paid ? 'Mark as unpaid' : 'Mark as paid')
                    ->iconButton()
                    ->icon(fn (Application $record): string => $record->is_paid ? 'heroicon-o-arrow-uturn-left' : 'heroicon-o-banknotes')
                    ->color(fn (Application $record): string => $record->is_paid ? 'gray' : 'success')
                    ->requiresConfirmation()
                    ->modalHeading(fn (Application $record): string => $record->is_paid ? 'Mark as unpaid' : 'Mark as paid')
                    ->modalDescription(function (Application $record): string {
                        $fee = config('icpep.currency_symbol').number_format((float) config('icpep.membership_fee'), 0);

                        return $record->is_paid
                            ? "This removes {$fee} from the revenue total and clears {$record->full_name}'s payment date."
                            : "This adds {$fee} to the revenue total and records today as {$record->full_name}'s payment date.";
                    })
                    ->action(fn (Application $record) => $record->update([
                        'paid_at' => $record->is_paid ? null : now(),
                    ])),
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
                    Tables\Actions\BulkAction::make('mark_paid')
                        ->label('Mark as paid')
                        ->icon('heroicon-o-banknotes')
                        ->color('success')
                        ->requiresConfirmation()
                        ->modalHeading('Mark as paid')
                        ->modalDescription('Records today as the payment date for the selected members who have not paid yet. Members already marked paid keep their original date.')
                        ->action(function (Collection $records): void {
                            // Skip members already paid so a bulk run never
                            // rewrites a payment date that is already on record.
                            $records->whereNull('paid_at')->each->update(['paid_at' => now()]);
                        })
                        ->deselectRecordsAfterCompletion(),
                    Tables\Actions\BulkAction::make('mark_unpaid')
                        ->label('Mark as unpaid')
                        ->icon('heroicon-o-arrow-uturn-left')
                        ->color('gray')
                        ->requiresConfirmation()
                        ->modalHeading('Mark as unpaid')
                        ->modalDescription('Clears the payment date for the selected members and removes their fees from the revenue total.')
                        ->action(fn (Collection $records) => $records->whereNotNull('paid_at')->each->update(['paid_at' => null]))
                        ->deselectRecordsAfterCompletion(),
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
                // Mirrors the public form's order, with the derived/system
                // fields (class code, registered date) kept alongside.
                InfoSection::make('Member')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('full_name')->label('Full Name'),
                        TextEntry::make('class_code')
                            ->label('Class')
                            ->badge()
                            ->color('primary'),
                        TextEntry::make('year_level')->label('Year Level'),
                        TextEntry::make('section')->label('Section'),
                        TextEntry::make('birthday')->label('Birthday')->date('F j, Y'),
                        TextEntry::make('created_at')->label('Registered')->dateTime('F j, Y g:i A'),
                        TextEntry::make('address')->label('Address')->columnSpanFull(),
                        TextEntry::make('email')->label('Email')->copyable()->icon('heroicon-o-envelope'),
                        TextEntry::make('phone')->label('Phone Number')->copyable()->icon('heroicon-o-phone'),
                    ]),
                InfoSection::make('Membership Fee')
                    ->columns(2)
                    ->schema([
                        TextEntry::make('paid_at')
                            ->label('Status')
                            ->badge()
                            ->state(fn (Application $record): string => $record->is_paid ? 'Paid' : 'Unpaid')
                            ->color(fn (Application $record): string => $record->is_paid ? 'success' : 'gray')
                            ->icon(fn (Application $record): string => $record->is_paid ? 'heroicon-m-check-circle' : 'heroicon-m-clock'),
                        TextEntry::make('paid_at')
                            ->label('Date paid')
                            ->placeholder('Not paid yet')
                            ->dateTime('F j, Y g:i A'),
                    ]),
                InfoSection::make('Formal Picture')
                    ->schema([
                        ImageEntry::make('picture_path')
                            ->hiddenLabel()
                            ->disk('supabase')
                            ->visibility('private')
                            ->checkFileExistence(false)
                            ->height(260),
                    ]),
                InfoSection::make('E-Signature')
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
