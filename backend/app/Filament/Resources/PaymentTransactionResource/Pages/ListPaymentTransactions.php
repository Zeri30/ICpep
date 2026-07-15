<?php

namespace App\Filament\Resources\PaymentTransactionResource\Pages;

use App\Filament\Resources\PaymentTransactionResource;
use App\Filament\Widgets\PaymentSummary;
use Filament\Resources\Pages\ListRecords;

class ListPaymentTransactions extends ListRecords
{
    protected static string $resource = PaymentTransactionResource::class;

    /** The collected-today/week/month cards sit above the history. */
    protected function getHeaderWidgets(): array
    {
        return [
            PaymentSummary::class,
        ];
    }
}
