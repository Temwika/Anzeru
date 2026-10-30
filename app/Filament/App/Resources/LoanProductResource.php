<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\LoanProductResource\Pages;
use App\Models\LoanProduct;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class LoanProductResource extends Resource
{
    protected static ?string $model = LoanProduct::class;
    protected static ?string $navigationIcon = 'heroicon-o-tag';
    protected static ?string $navigationLabel = 'Loan Products';
    protected static ?string $navigationGroup = 'Settings';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make()->columns(2)->schema([
                Forms\Components\TextInput::make('name')->required(),
                Forms\Components\TextInput::make('code')->required()->maxLength(16)->uppercase(),
                Forms\Components\Textarea::make('description')->columnSpanFull(),
                Forms\Components\Select::make('interest_method')
                    ->options([
                        'reducing_balance' => 'Reducing Balance',
                        'flat' => 'Flat',
                        'flat_term' => 'Flat for Term',
                        'interest_only' => 'Interest Only (Bullet)',
                    ])->required(),
                Forms\Components\TextInput::make('annual_rate_pct')
                    ->label('Annual Rate %')->numeric()->required(),
                Forms\Components\Select::make('repayment_frequency')
                    ->options(['daily' => 'Daily', 'weekly' => 'Weekly', 'fortnightly' => 'Fortnightly', 'monthly' => 'Monthly'])
                    ->required(),
                Forms\Components\TextInput::make('min_amount')->numeric()->prefix('ZMW')->required(),
                Forms\Components\TextInput::make('max_amount')->numeric()->prefix('ZMW')->required(),
                Forms\Components\TextInput::make('min_term')->integer()->required(),
                Forms\Components\TextInput::make('max_term')->integer()->required(),
                Forms\Components\TextInput::make('processing_fee_pct')->label('Processing Fee %')->numeric()->default(0),
                Forms\Components\TextInput::make('penalty_pct')->label('Penalty %')->numeric()->default(0),
                Forms\Components\TextInput::make('grace_days')->integer()->default(0),
                Forms\Components\TextInput::make('max_dti_pct')->label('Max DTI %')->numeric()->default(40),
                Forms\Components\Toggle::make('requires_guarantor'),
                Forms\Components\Toggle::make('requires_collateral'),
                Forms\Components\Toggle::make('is_active')->default(true),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('code')->sortable(),
                Tables\Columns\TextColumn::make('name')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('interest_method')->label('Method')->badge(),
                Tables\Columns\TextColumn::make('annual_rate_pct')->label('Rate %')->suffix('%'),
                Tables\Columns\TextColumn::make('repayment_frequency')->label('Frequency'),
                Tables\Columns\TextColumn::make('min_amount')->money('ZMW'),
                Tables\Columns\TextColumn::make('max_amount')->money('ZMW'),
                Tables\Columns\TextColumn::make('term_label')->label('Term')->state(fn (LoanProduct $r) => "{$r->min_term}–{$r->max_term}"),
                Tables\Columns\IconColumn::make('is_active')->boolean(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('toggle')
                    ->label(fn (LoanProduct $r) => $r->is_active ? 'Deactivate' : 'Activate')
                    ->icon(fn (LoanProduct $r) => $r->is_active ? 'heroicon-o-eye-slash' : 'heroicon-o-eye')
                    ->action(fn (LoanProduct $r) => $r->update(['is_active' => !$r->is_active])),
            ])
            ->bulkActions([]);
    }

    public static function getRelations(): array { return []; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLoanProducts::route('/'),
            'create' => Pages\CreateLoanProduct::route('/create'),
            'edit' => Pages\EditLoanProduct::route('/{record}/edit'),
        ];
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = (string) Str::uuid();
        $data['tenant_id'] = app()->bound('tenant') ? app('tenant')->id : null;
        return $data;
    }
}
