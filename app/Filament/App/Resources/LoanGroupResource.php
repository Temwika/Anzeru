<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\LoanGroupResource\Pages;
use App\Models\Branch;
use App\Models\LoanGroup;
use App\Models\User;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class LoanGroupResource extends Resource
{
    protected static ?string $model = LoanGroup::class;
    protected static ?string $navigationIcon = 'heroicon-o-user-group';
    protected static ?string $navigationGroup = 'Lending';
    protected static ?int $navigationSort = 5;

    public static function form(Form $form): Form
    {
        return $form->schema([
            TextInput::make('name')->required()->maxLength(100),
            Select::make('branch_id')
                ->label('Branch')
                ->options(Branch::pluck('name', 'id'))
                ->required(),
            Select::make('officer_id')
                ->label('Loan Officer')
                ->options(
                    User::whereIn('role', ['credit_officer', 'credit_manager'])->pluck('full_name', 'id')
                )
                ->nullable(),
            TextInput::make('meeting_place')->maxLength(100),
            TextInput::make('meeting_day')->maxLength(20),
            Toggle::make('is_active')->default(true),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->sortable()->searchable(),
                TextColumn::make('branch.name')->label('Branch'),
                TextColumn::make('officer.full_name')->label('Officer'),
                TextColumn::make('members_count')->counts('members')->label('Members'),
                IconColumn::make('is_active')->boolean(),
            ])
            ->filters([
                SelectFilter::make('branch_id')->label('Branch')
                    ->options(Branch::pluck('name', 'id')),
            ])
            ->actions([EditAction::make()]);
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id']         = Str::uuid()->toString();
        $data['created_by'] = auth()->id();
        return $data;
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListLoanGroups::route('/'),
            'create' => Pages\CreateLoanGroup::route('/create'),
            'edit'   => Pages\EditLoanGroup::route('/{record}/edit'),
        ];
    }
}
