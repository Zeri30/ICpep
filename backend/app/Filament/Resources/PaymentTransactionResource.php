<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaymentTransactionResource\Pages;
use App\Models\PaymentTransaction;
use Filament\Forms;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class PaymentTransactionResource extends Resource
{
    protected static ?string $model = PaymentTransaction::class;

    protected static ?string $navigationIcon = 'heroicon-o-banknotes';

    protected static ?string $navigationLabel = 'Payment History';

    protected static ?string $modelLabel = 'payment record';

    protected static ?string $pluralModelLabel = 'payment history';

    protected static ?int $navigationSort = 2;

    /** Year & Section options offered on the public membership form. */
    protected const SECTIONS = ['Section A', 'Section B'];

    /**
     * The ledger is written by Application's model events. Letting it be created,
     * edited or deleted by hand would make it useless as an audit trail.
     */
    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) static::getModel()::count();
    }

    public static function table(Table $table): Table
    {
        $symbol = config('icpep.currency_symbol');

        return $table
            ->defaultSort('created_at', 'desc')
            ->paginated([25, 50, 100])
            ->defaultPaginationPageOption(25)
            ->columns([
                TextColumn::make('member_name')
                    ->label('Member')
                    ->description(fn (PaymentTransaction $record): ?string => $record->section)
                    // Search the snapshot and the live member record, so a member
                    // renamed after paying is findable under either name.
                    ->searchable(query: fn (Builder $query, string $search): Builder => $query
                        ->where('member_name', 'like', "%{$search}%")
                        ->orWhereHas('application', fn (Builder $q): Builder => $q
                            ->where('surname', 'like', "%{$search}%")
                            ->orWhere('given_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")))
                    ->sortable(),

                TextColumn::make('action')
                    ->label('Event')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        PaymentTransaction::PAID => 'success',
                        PaymentTransaction::REVOKED => 'danger',
                        default => 'warning',
                    })
                    ->icon(fn (string $state): string => match ($state) {
                        PaymentTransaction::PAID => 'heroicon-m-check-circle',
                        PaymentTransaction::REVOKED => 'heroicon-m-x-circle',
                        default => 'heroicon-m-pencil-square',
                    })
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        PaymentTransaction::PAID => 'Paid',
                        PaymentTransaction::REVOKED => 'Revoked',
                        default => 'Date adjusted',
                    }),

                TextColumn::make('amount')
                    ->label('Amount')
                    ->alignEnd()
                    ->formatStateUsing(fn ($state): string => match (true) {
                        (float) $state > 0 => '+'.$symbol.number_format((float) $state, 2),
                        (float) $state < 0 => '−'.$symbol.number_format(abs((float) $state), 2),
                        default => '—',
                    })
                    ->color(fn ($state): string => match (true) {
                        (float) $state > 0 => 'success',
                        (float) $state < 0 => 'danger',
                        default => 'gray',
                    })
                    ->weight('semibold'),

                TextColumn::make('effective_at')
                    ->label('Payment date')
                    ->dateTime('M j, Y g:i A')
                    ->placeholder('—')
                    ->description(fn (PaymentTransaction $record): ?string => $record->action === PaymentTransaction::REVOKED
                        ? 'the payment this cancels'
                        : null)
                    ->sortable(),

                // The requirement's "exact date and time it was made / revoked":
                // effective_at is when the money moved, created_at is when the
                // officer recorded it. They differ on a back-dated entry.
                TextColumn::make('created_at')
                    ->label('Recorded')
                    ->dateTime('M j, Y g:i A')
                    ->description(fn (PaymentTransaction $record): string => $record->created_at->diffForHumans())
                    ->sortable(),

                TextColumn::make('actor')
                    ->label('By')
                    ->placeholder('System')
                    ->toggleable()
                    ->searchable(),

                TextColumn::make('note')
                    ->label('Note')
                    ->placeholder('—')
                    ->wrap()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('action')
                    ->label('Event')
                    ->options([
                        PaymentTransaction::PAID => 'Paid',
                        PaymentTransaction::REVOKED => 'Revoked',
                        PaymentTransaction::ADJUSTED => 'Date adjusted',
                    ]),

                Tables\Filters\SelectFilter::make('section')
                    ->label('Section')
                    ->options(array_combine(self::SECTIONS, self::SECTIONS)),

                Tables\Filters\Filter::make('date_range')
                    ->form([
                        Forms\Components\Select::make('field')
                            ->label('Date field')
                            ->options([
                                'effective_at' => 'Payment date',
                                'created_at' => 'Recorded',
                            ])
                            ->default('effective_at')
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
                        $field = in_array($data['field'] ?? null, ['effective_at', 'created_at'], true)
                            ? $data['field']
                            : 'effective_at';

                        // whereDate keeps both bounds inclusive; comparing a
                        // timestamp against a bare date would drop everything
                        // after midnight on the closing day.
                        return $query
                            ->when($data['from'] ?? null, fn (Builder $q, $d): Builder => $q->whereDate($field, '>=', $d))
                            ->when($data['until'] ?? null, fn (Builder $q, $d): Builder => $q->whereDate($field, '<=', $d));
                    })
                    ->indicateUsing(function (array $data): ?string {
                        if (blank($data['from'] ?? null) && blank($data['until'] ?? null)) {
                            return null;
                        }

                        $label = ($data['field'] ?? 'effective_at') === 'created_at' ? 'Recorded' : 'Payment date';
                        $from = filled($data['from'] ?? null) ? Carbon::parse($data['from'])->format('M j, Y') : null;
                        $until = filled($data['until'] ?? null) ? Carbon::parse($data['until'])->format('M j, Y') : null;

                        return match (true) {
                            $from && $until => "{$label}: {$from} – {$until}",
                            (bool) $from => "{$label}: from {$from}",
                            default => "{$label}: until {$until}",
                        };
                    }),
            ])
            ->actions([])
            ->bulkActions([])
            ->emptyStateHeading('No payments recorded yet')
            ->emptyStateDescription('Marking a member as paid in the Members List records it here.')
            ->emptyStateIcon('heroicon-o-banknotes');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPaymentTransactions::route('/'),
        ];
    }
}
