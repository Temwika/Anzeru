<?php

namespace App\Filament\App\Resources\LoanGroupResource\Pages;

use App\Filament\App\Resources\LoanGroupResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListLoanGroups extends ListRecords
{
    protected static string $resource = LoanGroupResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
