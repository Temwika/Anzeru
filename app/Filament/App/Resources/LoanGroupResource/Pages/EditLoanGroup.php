<?php

namespace App\Filament\App\Resources\LoanGroupResource\Pages;

use App\Filament\App\Resources\LoanGroupResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditLoanGroup extends EditRecord
{
    protected static string $resource = LoanGroupResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
