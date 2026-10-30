<?php

namespace App\Filament\App\Resources\LoanProductResource\Pages;

use App\Filament\App\Resources\LoanProductResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditLoanProduct extends EditRecord
{
    protected static string $resource = LoanProductResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
