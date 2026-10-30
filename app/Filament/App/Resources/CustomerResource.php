<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\CustomerResource\Pages;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\LoanGroup;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class CustomerResource extends Resource
{
    protected static ?string $model = Customer::class;
    protected static ?string $navigationIcon = 'heroicon-o-users';
    protected static ?string $navigationLabel = 'Borrowers';
    protected static ?string $navigationGroup = 'Portfolio';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Identity')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('first_name')->required(),
                    Forms\Components\TextInput::make('last_name')->required(),
                    Forms\Components\TextInput::make('nrc')
                        ->label('NRC')
                        ->placeholder('123456/78/1')
                        ->required()
                        ->maxLength(11),
                    Forms\Components\DatePicker::make('date_of_birth')->required(),
                    Forms\Components\Select::make('gender')
                        ->options(['male' => 'Male', 'female' => 'Female'])
                        ->required(),
                    Forms\Components\Select::make('branch_id')
                        ->label('Branch')
                        ->options(fn () => Branch::pluck('name', 'id'))
                        ->required()
                        ->searchable(),
                ]),
            Forms\Components\Section::make('Contact & Employment')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('phone')
                        ->tel()->required()->maxLength(16),
                    Forms\Components\TextInput::make('email')->email()->nullable(),
                    Forms\Components\Textarea::make('address')->required()->columnSpanFull(),
                    Forms\Components\TextInput::make('employer')->nullable(),
                    Forms\Components\TextInput::make('occupation')->nullable(),
                ]),
            Forms\Components\Section::make('Income & Next of Kin')
                ->columns(2)
                ->schema([
                    Forms\Components\TextInput::make('monthly_income')
                        ->numeric()->prefix('ZMW')->required(),
                    Forms\Components\Select::make('group_id')
                        ->label('Group')
                        ->options(fn () => LoanGroup::pluck('name', 'id'))
                        ->nullable()
                        ->searchable(),
                    Forms\Components\TextInput::make('next_of_kin_name')->nullable(),
                    Forms\Components\TextInput::make('next_of_kin_phone')->tel()->nullable(),
                ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('customer_number')
                    ->label('No.')
                    ->searchable()
                    ->sortable()
                    ->copyable(),
                Tables\Columns\TextColumn::make('full_name')
                    ->label('Name')
                    ->searchable(['first_name', 'last_name'])
                    ->sortable('last_name'),
                Tables\Columns\TextColumn::make('nrc')
                    ->label('NRC')
                    ->searchable(),
                Tables\Columns\TextColumn::make('phone')->searchable(),
                Tables\Columns\TextColumn::make('branch.name')->label('Branch')->sortable(),
                Tables\Columns\BadgeColumn::make('kyc_status')
                    ->label('KYC')
                    ->colors([
                        'warning' => 'pending',
                        'success' => 'verified',
                        'danger' => 'rejected',
                    ]),
                Tables\Columns\TextColumn::make('created_at')
                    ->date()->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('kyc_status')
                    ->options(['pending' => 'Pending', 'verified' => 'Verified', 'rejected' => 'Rejected']),
                Tables\Filters\SelectFilter::make('branch_id')
                    ->label('Branch')
                    ->options(fn () => Branch::pluck('name', 'id')),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
                Tables\Actions\Action::make('kyc')
                    ->label('Verify KYC')
                    ->icon('heroicon-o-check-badge')
                    ->visible(fn (Customer $r) => $r->kyc_status === 'pending')
                    ->requiresConfirmation(false)
                    ->form([
                        Forms\Components\Select::make('decision')
                            ->options(['verified' => 'Approve', 'rejected' => 'Reject'])
                            ->required(),
                        Forms\Components\Textarea::make('kyc_note')->label('Note')->nullable(),
                    ])
                    ->action(function (Customer $record, array $data) {
                        $record->update([
                            'kyc_status' => $data['decision'],
                            'kyc_note' => $data['kyc_note'] ?? null,
                            'kyc_decided_by' => auth()->id(),
                        ]);
                        Notification::make()->title('KYC updated')->success()->send();
                    }),
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
            'index' => Pages\ListCustomers::route('/'),
            'create' => Pages\CreateCustomer::route('/create'),
            'view' => Pages\ViewCustomer::route('/{record}'),
            'edit' => Pages\EditCustomer::route('/{record}/edit'),
        ];
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = (string) Str::uuid();
        $data['tenant_id'] = app()->bound('tenant') ? app('tenant')->id : null;
        $data['created_by'] = auth()->id();
        $data['consent_at'] = now();
        $tenantId = app()->bound('tenant') ? app('tenant')->id : null;
        if ($tenantId) {
            $data['customer_number'] = \App\Services\NumberingService::next('customer', $tenantId);
        }
        return $data;
    }
}
