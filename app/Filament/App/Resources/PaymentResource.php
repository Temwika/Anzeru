<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\PaymentResource\Pages;
use App\Models\Payment;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class PaymentResource extends Resource
{
    protected static ?string $model = Payment::class;
    protected static ?string $navigationIcon = 'heroicon-o-credit-card';
    protected static ?string $navigationLabel = 'Repayments';
    protected static ?string $navigationGroup = 'Portfolio';
    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('receipt_number')
                    ->label('Receipt')->searchable()->sortable()->copyable(),
                Tables\Columns\TextColumn::make('loan.loan_number')
                    ->label('Loan No.')->searchable(),
                Tables\Columns\TextColumn::make('loan.customer.full_name')
                    ->label('Borrower'),
                Tables\Columns\TextColumn::make('amount')->money('ZMW')->sortable(),
                Tables\Columns\TextColumn::make('channel')->badge(),
                Tables\Columns\TextColumn::make('received_on')->date()->sortable(),
                Tables\Columns\BadgeColumn::make('status')
                    ->colors(['success' => 'posted', 'danger' => 'reversed']),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['posted' => 'Posted', 'reversed' => 'Reversed']),
                Tables\Filters\SelectFilter::make('channel')
                    ->options(['cash' => 'Cash', 'bank' => 'Bank', 'mtn_momo' => 'MTN MoMo', 'airtel_money' => 'Airtel Money']),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\Action::make('reverse')
                    ->label('Request Reversal')
                    ->icon('heroicon-o-arrow-uturn-left')
                    ->color('warning')
                    ->visible(fn (Payment $r) => $r->status === 'posted')
                    ->form([
                        Forms\Components\Textarea::make('reason')->required(),
                    ])
                    ->action(function (Payment $record, array $data) {
                        \App\Models\PaymentReversal::create([
                            'id' => (string) \Illuminate\Support\Str::uuid(),
                            'tenant_id' => $record->tenant_id,
                            'payment_id' => $record->id,
                            'reason' => $data['reason'],
                            'requested_by' => auth()->id(),
                        ]);
                        \Filament\Notifications\Notification::make()->title('Reversal requested')->warning()->send();
                    }),
            ])
            ->bulkActions([])
            ->defaultSort('received_on', 'desc');
    }

    public static function getRelations(): array { return []; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPayments::route('/'),
        ];
    }
}
