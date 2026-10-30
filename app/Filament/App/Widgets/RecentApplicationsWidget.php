<?php

namespace App\Filament\App\Widgets;

use App\Filament\App\Resources\LoanApplicationResource;
use App\Models\LoanApplication;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class RecentApplicationsWidget extends TableWidget
{
    protected static ?int $sort = 3;
    protected int|string|array $columnSpan = 'full';
    protected static ?string $heading = 'Recent Applications';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                LoanApplication::with(['customer', 'product'])
                    ->latest('submitted_at')
                    ->limit(10)
            )
            ->columns([
                TextColumn::make('application_number')->label('App #')->fontFamily('mono'),
                TextColumn::make('customer.full_name')->label('Customer'),
                TextColumn::make('product.name')->label('Product'),
                TextColumn::make('amount_requested')
                    ->label('Amount')
                    ->money('MWK')
                    ->alignEnd(),
                TextColumn::make('status')->badge()->color(fn ($state) => match ($state) {
                    'submitted' => 'warning',
                    'approved'  => 'success',
                    'rejected'  => 'danger',
                    default     => 'gray',
                }),
                TextColumn::make('submitted_at')->since()->label('Submitted'),
            ])
            ->actions([
                \Filament\Tables\Actions\ViewAction::make()
                    ->url(fn ($record) => LoanApplicationResource::getUrl('view', ['record' => $record])),
            ])
            ->paginated(false);
    }
}
