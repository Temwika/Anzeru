<?php

namespace App\Filament\App\Resources\LoanResource\Pages;

use App\Filament\App\Resources\LoanResource;
use Filament\Actions;
use Filament\Resources\Pages\ViewRecord;

class ViewLoan extends ViewRecord
{
    protected static string $resource = LoanResource::class;

    public function getTitle(): string
    {
        return 'Loan ' . $this->getRecord()->loan_number;
    }
}
