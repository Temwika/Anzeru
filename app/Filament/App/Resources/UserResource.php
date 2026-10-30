<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\UserResource\Pages;
use App\Models\Branch;
use App\Models\User;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserResource extends Resource
{
    protected static ?string $model = User::class;
    protected static ?string $navigationIcon = 'heroicon-o-user-group';
    protected static ?string $navigationLabel = 'Staff';
    protected static ?string $navigationGroup = 'Settings';
    protected static ?int $navigationSort = 3;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make()->columns(2)->schema([
                Forms\Components\TextInput::make('full_name')->required(),
                Forms\Components\TextInput::make('email')->email()->required()->unique(ignoreRecord: true),
                Forms\Components\TextInput::make('password_hash')
                    ->label('Password')
                    ->password()
                    ->dehydrated(fn ($state) => filled($state))
                    ->dehydrateStateUsing(fn ($state) => Hash::make($state))
                    ->required(fn (string $operation) => $operation === 'create'),
                Forms\Components\Select::make('role')
                    ->options([
                        'institution_admin' => 'Institution Admin',
                        'credit_officer' => 'Credit Officer',
                        'credit_manager' => 'Credit Manager',
                        'cashier' => 'Cashier',
                        'accountant' => 'Accountant',
                        'auditor' => 'Auditor',
                    ])->required(),
                Forms\Components\TextInput::make('approval_limit')
                    ->label('Approval Limit (ZMW)')->numeric()->default(0),
                Forms\Components\Toggle::make('is_active')->default(true),
                Forms\Components\Select::make('branch_ids')
                    ->label('Branch Access')
                    ->multiple()
                    ->options(fn () => Branch::pluck('name', 'id'))
                    ->relationship('branches', 'name'),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('full_name')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('email')->searchable(),
                Tables\Columns\BadgeColumn::make('role')
                    ->colors([
                        'danger' => 'institution_admin',
                        'warning' => fn ($state) => in_array($state, ['credit_manager', 'credit_officer']),
                        'success' => 'cashier',
                        'gray' => fn ($state) => in_array($state, ['accountant', 'auditor']),
                    ]),
                Tables\Columns\TextColumn::make('approval_limit')->money('ZMW'),
                Tables\Columns\IconColumn::make('is_active')->boolean(),
                Tables\Columns\TextColumn::make('last_login_at')->dateTime()->sortable(),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('toggle_active')
                    ->label(fn (User $r) => $r->is_active ? 'Deactivate' : 'Activate')
                    ->action(fn (User $r) => $r->update(['is_active' => !$r->is_active])),
            ])
            ->bulkActions([]);
    }

    public static function getEloquentQuery(): \Illuminate\Database\Eloquent\Builder
    {
        return parent::getEloquentQuery()
            ->where('role', '!=', 'platform_admin')
            ->where('role', '!=', 'borrower');
    }

    public static function getRelations(): array { return []; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = (string) Str::uuid();
        $data['tenant_id'] = app()->bound('tenant') ? app('tenant')->id : null;
        return $data;
    }
}
