<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\LoanApplicationResource\Pages;
use App\Models\Customer;
use App\Models\LoanApplication;
use App\Models\LoanProduct;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class LoanApplicationResource extends Resource
{
    protected static ?string $model = LoanApplication::class;
    protected static ?string $navigationIcon = 'heroicon-o-document-text';
    protected static ?string $navigationLabel = 'Applications';
    protected static ?string $navigationGroup = 'Portfolio';
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make()->columns(2)->schema([
                Forms\Components\Select::make('customer_id')
                    ->label('Borrower')
                    ->options(fn () => Customer::selectRaw("id, first_name || ' ' || last_name || ' (' || customer_number || ')' as name")->pluck('name', 'id'))
                    ->searchable()->required(),
                Forms\Components\Select::make('product_id')
                    ->label('Product')
                    ->options(fn () => LoanProduct::where('is_active', true)->pluck('name', 'id'))
                    ->required()->reactive(),
                Forms\Components\TextInput::make('amount')
                    ->label('Amount (ZMW)')->numeric()->required(),
                Forms\Components\TextInput::make('term')
                    ->label('Term (periods)')->integer()->required(),
                Forms\Components\Textarea::make('purpose')->required()->columnSpanFull(),
                Forms\Components\TextInput::make('monthly_income')
                    ->label('Monthly Income')->numeric()->required(),
                Forms\Components\TextInput::make('monthly_expenses')
                    ->label('Monthly Expenses')->numeric()->required(),
                Forms\Components\TextInput::make('existing_debt_repayments')
                    ->label('Existing Debt Repayments')->numeric()->required()->default(0),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('application_number')
                    ->label('App No.')->searchable()->sortable()->copyable(),
                Tables\Columns\TextColumn::make('customer.full_name')
                    ->label('Borrower')->searchable(['customers.first_name', 'customers.last_name']),
                Tables\Columns\TextColumn::make('product.name')->label('Product'),
                Tables\Columns\TextColumn::make('amount')->money('ZMW')->sortable(),
                Tables\Columns\TextColumn::make('term')->suffix(' mo'),
                Tables\Columns\BadgeColumn::make('status')
                    ->colors([
                        'warning' => 'submitted',
                        'success' => 'approved',
                        'danger' => 'rejected',
                        'gray' => 'cancelled',
                    ]),
                Tables\Columns\TextColumn::make('submitted_at')->date()->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['submitted' => 'Submitted', 'approved' => 'Approved', 'rejected' => 'Rejected', 'cancelled' => 'Cancelled']),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->visible(fn (LoanApplication $r) => $r->status === 'submitted')
                    ->form([
                        Forms\Components\Textarea::make('reason')->label('Notes')->nullable(),
                    ])
                    ->action(function (LoanApplication $record, array $data) {
                        $record->update([
                            'status' => 'approved',
                            'decided_at' => now(),
                            'assessment' => array_merge($record->assessment ?? [], ['decidedNote' => $data['reason'] ?? '']),
                        ]);
                        \App\Models\CreditDecision::create([
                            'id' => (string) Str::uuid(),
                            'tenant_id' => $record->tenant_id,
                            'application_id' => $record->id,
                            'decision' => 'approved',
                            'reason' => $data['reason'] ?? 'Approved',
                            'approver_limit' => auth()->user()->approval_limit ?? 0,
                            'decided_by' => auth()->id(),
                        ]);
                        Notification::make()->title('Application approved')->success()->send();
                    }),
                Tables\Actions\Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-mark')
                    ->color('danger')
                    ->visible(fn (LoanApplication $r) => $r->status === 'submitted')
                    ->form([
                        Forms\Components\Textarea::make('reason')->label('Reason for rejection')->required(),
                    ])
                    ->action(function (LoanApplication $record, array $data) {
                        $record->update(['status' => 'rejected', 'decided_at' => now()]);
                        \App\Models\CreditDecision::create([
                            'id' => (string) Str::uuid(),
                            'tenant_id' => $record->tenant_id,
                            'application_id' => $record->id,
                            'decision' => 'rejected',
                            'reason' => $data['reason'],
                            'approver_limit' => auth()->user()->approval_limit ?? 0,
                            'decided_by' => auth()->id(),
                        ]);
                        Notification::make()->title('Application rejected')->warning()->send();
                    }),
            ])
            ->bulkActions([])
            ->defaultSort('submitted_at', 'desc');
    }

    public static function getRelations(): array { return []; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLoanApplications::route('/'),
            'create' => Pages\CreateLoanApplication::route('/create'),
            'view' => Pages\ViewLoanApplication::route('/{record}'),
        ];
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = (string) Str::uuid();
        $data['tenant_id'] = app()->bound('tenant') ? app('tenant')->id : null;
        $data['branch_id'] = auth()->user()->branches()->first()?->id ?? null;
        $data['submitted_by'] = auth()->id();
        $data['assessment'] = [];
        $data['submitted_at'] = now();
        $tenantId = $data['tenant_id'];
        if ($tenantId) {
            $data['application_number'] = \App\Services\NumberingService::next('application', $tenantId);
        }
        return $data;
    }
}
