<?php

namespace App\Filament\Platform\Resources;

use App\Filament\Platform\Resources\TenantResource\Pages;
use App\Models\Tenant;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables\Actions\EditAction;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\BadgeColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Support\Str;

class TenantResource extends Resource
{
    protected static ?string $model = Tenant::class;
    protected static ?string $navigationIcon = 'heroicon-o-building-library';

    public static function form(Form $form): Form
    {
        return $form->schema([
            TextInput::make('name')->required()->maxLength(120),
            TextInput::make('code')->required()->maxLength(12)->upperCase(),
            TextInput::make('currency')->default('MWK')->maxLength(3),
            TextInput::make('timezone')->default('Africa/Blantyre'),
            Select::make('plan')
                ->options(['starter' => 'Starter', 'growth' => 'Growth', 'enterprise' => 'Enterprise'])
                ->default('starter')
                ->required(),
            Select::make('status')
                ->options(['active' => 'Active', 'suspended' => 'Suspended', 'trial' => 'Trial'])
                ->default('trial')
                ->required(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('code')->badge(),
                TextColumn::make('plan')->badge()->color(fn ($state) => match ($state) {
                    'enterprise' => 'success',
                    'growth'     => 'primary',
                    default      => 'gray',
                }),
                TextColumn::make('status')->badge()->color(fn ($state) => match ($state) {
                    'active'    => 'success',
                    'suspended' => 'danger',
                    default     => 'warning',
                }),
                TextColumn::make('users_count')->counts('users')->label('Users'),
                TextColumn::make('created_at')->date()->sortable(),
            ])
            ->filters([
                SelectFilter::make('plan')
                    ->options(['starter' => 'Starter', 'growth' => 'Growth', 'enterprise' => 'Enterprise']),
                SelectFilter::make('status')
                    ->options(['active' => 'Active', 'suspended' => 'Suspended', 'trial' => 'Trial']),
            ])
            ->actions([
                ViewAction::make(),
                EditAction::make(),
            ]);
    }

    public static function mutateFormDataBeforeCreate(array $data): array
    {
        $data['id'] = Str::uuid()->toString();
        return $data;
    }

    public static function getPages(): array
    {
        return [
            'index'  => Pages\ListTenants::route('/'),
            'create' => Pages\CreateTenant::route('/create'),
            'edit'   => Pages\EditTenant::route('/{record}/edit'),
        ];
    }
}
