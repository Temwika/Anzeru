<?php

namespace App\Filament\App\Resources;

use App\Filament\App\Resources\JournalEntryResource\Pages;
use App\Models\JournalEntry;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables\Actions\ViewAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;
use Filament\Forms\Components\DatePicker;

class JournalEntryResource extends Resource
{
    protected static ?string $model = JournalEntry::class;
    protected static ?string $navigationIcon = 'heroicon-o-book-open';
    protected static ?string $navigationGroup = 'Accounting';
    protected static ?int $navigationSort = 1;

    public static function form(Form $form): Form
    {
        return $form->schema([]); // entries created by system only
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('entry_date', 'desc')
            ->columns([
                TextColumn::make('entry_number')->searchable()->sortable(),
                TextColumn::make('entry_date')->date()->sortable(),
                TextColumn::make('description')->limit(50)->searchable(),
                TextColumn::make('source_type')->badge(),
                TextColumn::make('poster.full_name')->label('Posted By'),
            ])
            ->filters([
                Filter::make('entry_date')
                    ->form([
                        DatePicker::make('from'),
                        DatePicker::make('until'),
                    ])
                    ->query(fn ($query, array $data) => $query
                        ->when($data['from'],  fn ($q, $v) => $q->whereDate('entry_date', '>=', $v))
                        ->when($data['until'], fn ($q, $v) => $q->whereDate('entry_date', '<=', $v))
                    ),
            ])
            ->actions([ViewAction::make()])
            ->paginated([25, 50, 100]);
    }

    public static function canCreate(): bool { return false; }
    public static function canEdit($record): bool { return false; }
    public static function canDelete($record): bool { return false; }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListJournalEntries::route('/'),
            'view'  => Pages\ViewJournalEntry::route('/{record}'),
        ];
    }
}
