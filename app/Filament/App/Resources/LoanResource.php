<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\LoanResource\Pages;
use App\Models\Loan;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Infolists\Components\ViewEntry;
use Filament\Infolists\Infolist;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class LoanResource extends Resource
{
    protected static ?string $model = Loan::class;
    protected static ?string $navigationIcon = 'heroicon-o-banknotes';
    protected static ?string $navigationLabel = 'Loans';
    protected static ?string $navigationGroup = 'Portfolio';
    protected static ?int $navigationSort = 3;

    /* Ctrl+K search: by loan number or the borrower's name. */
    public static function getGloballySearchableAttributes(): array
    {
        return ['loan_number', 'customer.first_name', 'customer.last_name'];
    }

    public static function getGlobalSearchResultTitle(\Illuminate\Database\Eloquent\Model $record): string
    {
        return $record->loan_number;
    }

    public static function getGlobalSearchResultDetails(\Illuminate\Database\Eloquent\Model $record): array
    {
        return [
            'Borrower' => trim(($record->customer?->first_name ?? '') . ' ' . ($record->customer?->last_name ?? '')),
            'Principal' => 'K ' . number_format((float) $record->principal, 2),
            'Status' => ucfirst(str_replace('_', ' ', $record->status)),
        ];
    }

    public static function getGlobalSearchEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getGlobalSearchEloquentQuery()->with('customer');
    }

    public static function getGlobalSearchResultUrl(\Illuminate\Database\Eloquent\Model $record): string
    {
        return static::getUrl('view', ['record' => $record]);
    }

    public static function form(Form $form): Form
    {
        return $form->schema([]); // Loans are created from approved applications only
    }

    /** The view page: a statement of the loan with its schedule and payments. */
    public static function infolist(Infolist $infolist): Infolist
    {
        return $infolist->schema([
            ViewEntry::make('statement')->view('filament.app.loan-statement')->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('loan_number')
                    ->label('Loan No.')
                    ->searchable()->sortable()->copyable(),
                Tables\Columns\TextColumn::make('customer.full_name')
                    ->label('Borrower')->searchable(['customers.first_name', 'customers.last_name']),
                Tables\Columns\TextColumn::make('product.name')->label('Product'),
                Tables\Columns\TextColumn::make('principal')
                    ->label('Principal')->money('ZMW')->sortable(),
                Tables\Columns\TextColumn::make('disbursed_on')->date()->sortable(),
                Tables\Columns\TextColumn::make('maturity_date')->date()->sortable(),
                Tables\Columns\BadgeColumn::make('status')
                    ->formatStateUsing(fn ($state) => ucfirst(str_replace('_', ' ', $state)))
                    ->colors([
                        'warning' => 'pending_disbursement',
                        'success' => 'active',
                        'gray' => 'closed',
                        'danger' => 'written_off',
                    ]),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending_disbursement' => 'Pending Disbursement',
                        'active' => 'Active',
                        'closed' => 'Closed',
                        'written_off' => 'Written Off',
                    ]),
                Tables\Filters\SelectFilter::make('product_id')
                    ->label('Product')
                    ->relationship('product', 'name'),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
            ])
            ->bulkActions([])
            ->defaultSort('created_at', 'desc');
    }

    public static function getRelations(): array
    {
        return [];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLoans::route('/'),
            'view'  => Pages\ViewLoan::route('/{record}'),
        ];
    }
}
