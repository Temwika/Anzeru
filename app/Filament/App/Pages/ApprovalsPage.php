<?php

namespace App\Filament\App\Pages;

use App\Models\LoanDisbursement;
use App\Models\PaymentReversal;
use App\Services\AuditService;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Tables\Actions\Action as TableAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Table;

class ApprovalsPage extends Page implements HasTable
{
    use InteractsWithTable;

    protected static ?string $navigationIcon = 'heroicon-o-check-badge';
    protected static ?string $navigationLabel = 'Approvals';
    protected static string $view = 'filament.app.pages.approvals';
    protected static ?int $navigationSort = 99;

    // Which queue to display: 'disbursements' or 'reversals'
    public string $queue = 'disbursements';

    public function table(Table $table): Table
    {
        if ($this->queue === 'reversals') {
            return $this->reversalsTable($table);
        }
        return $this->disbursementsTable($table);
    }

    private function disbursementsTable(Table $table): Table
    {
        return $table
            ->query(
                LoanDisbursement::with(['loan.customer', 'loan.product', 'requester'])
                    ->where('status', 'requested')
            )
            ->columns([
                TextColumn::make('loan.loan_number')->label('Loan #')->sortable(),
                TextColumn::make('loan.customer.full_name')->label('Borrower'),
                TextColumn::make('loan.product.name')->label('Product'),
                TextColumn::make('amount')->money('ZMW')->alignEnd(),
                TextColumn::make('channel')->badge(),
                TextColumn::make('destination')->limit(30),
                TextColumn::make('requester.full_name')->label('Requested By'),
                TextColumn::make('requested_at')->since()->label('Requested'),
            ])
            ->actions([
                TableAction::make('authorise')
                    ->label('Authorise')
                    ->color('success')
                    ->icon('heroicon-o-check')
                    ->requiresConfirmation()
                    ->visible(fn () => auth()->user()->can('disbursements:authorise'))
                    ->action(function (LoanDisbursement $record) {
                        if ($record->requested_by === auth()->id()) {
                            Notification::make()->title('Cannot authorise your own request')->danger()->send();
                            return;
                        }
                        $record->update([
                            'status'     => 'completed',
                            'decided_by' => auth()->id(),
                            'decided_at' => now(),
                        ]);
                        $record->loan->update([
                            'status'      => 'active',
                            'disbursed_on' => $record->value_date,
                        ]);
                        AuditService::log('disbursement.authorised', 'loan_disbursement', $record->id);
                        Notification::make()->title('Disbursement authorised')->success()->send();
                    }),
                TableAction::make('reject')
                    ->label('Reject')
                    ->color('danger')
                    ->icon('heroicon-o-x-mark')
                    ->form([Textarea::make('note')->label('Reason')->required()])
                    ->action(function (LoanDisbursement $record, array $data) {
                        $record->update([
                            'status'     => 'rejected',
                            'decided_by' => auth()->id(),
                            'decided_at' => now(),
                            'note'       => $data['note'],
                        ]);
                        AuditService::log('disbursement.rejected', 'loan_disbursement', $record->id, ['note' => $data['note']]);
                        Notification::make()->title('Disbursement rejected')->success()->send();
                    }),
            ]);
    }

    private function reversalsTable(Table $table): Table
    {
        return $table
            ->query(
                PaymentReversal::with(['payment.loan.customer', 'requester'])
                    ->where('status', 'requested')
            )
            ->columns([
                TextColumn::make('payment.receipt_number')->label('Receipt #'),
                TextColumn::make('payment.loan.customer.full_name')->label('Borrower'),
                TextColumn::make('payment.amount')->money('ZMW')->label('Amount')->alignEnd(),
                TextColumn::make('reason')->limit(40),
                TextColumn::make('requester.full_name')->label('Requested By'),
                TextColumn::make('requested_at')->since()->label('Requested'),
            ])
            ->actions([
                TableAction::make('approve')
                    ->label('Approve')
                    ->color('success')
                    ->requiresConfirmation()
                    ->action(function (PaymentReversal $record) {
                        $record->update(['status' => 'approved', 'decided_by' => auth()->id(), 'decided_at' => now()]);
                        $record->payment->update(['status' => 'reversed']);
                        AuditService::log('reversal.approved', 'payment_reversal', $record->id);
                        Notification::make()->title('Reversal approved')->success()->send();
                    }),
                TableAction::make('reject')
                    ->label('Reject')
                    ->color('danger')
                    ->form([Textarea::make('note')->label('Reason')->required()])
                    ->action(function (PaymentReversal $record, array $data) {
                        $record->update(['status' => 'rejected', 'decided_by' => auth()->id(), 'decided_at' => now(), 'note' => $data['note']]);
                        AuditService::log('reversal.rejected', 'payment_reversal', $record->id, ['note' => $data['note']]);
                        Notification::make()->title('Reversal rejected')->success()->send();
                    }),
            ]);
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('switchToDisbursements')
                ->label('Disbursements')
                ->color($this->queue === 'disbursements' ? 'primary' : 'gray')
                ->action(fn () => $this->queue = 'disbursements'),
            Action::make('switchToReversals')
                ->label('Reversals')
                ->color($this->queue === 'reversals' ? 'primary' : 'gray')
                ->action(fn () => $this->queue = 'reversals'),
        ];
    }
}
