<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\AuditLogResource\Pages;
use App\Models\AuditLog;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class AuditLogResource extends Resource
{
    protected static ?string $model = AuditLog::class;
    protected static ?string $navigationIcon = 'heroicon-o-shield-check';
    protected static ?string $navigationGroup = 'Accounting';
    protected static ?int $navigationSort = 2;

    public static function form(Form $form): Form
    {
        return $form->schema([]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('seq', 'desc')
            ->columns([
                TextColumn::make('seq')->sortable()->label('#'),
                TextColumn::make('created_at')->dateTime()->sortable()->label('When'),
                TextColumn::make('user_id')->limit(12)->label('User')->fontFamily('mono'),
                TextColumn::make('action')->badge(),
                TextColumn::make('entity_type')->label('Entity'),
                TextColumn::make('entity_id')->limit(12)->fontFamily('mono'),
            ])
            ->actions([ViewAction::make()])
            ->paginated([50, 100]);
    }

    public static function canCreate(): bool { return false; }
    public static function canEdit($record): bool { return false; }
    public static function canDelete($record): bool { return false; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAuditLogs::route('/'),
            'view'  => Pages\ViewAuditLog::route('/{record}'),
        ];
    }
}
