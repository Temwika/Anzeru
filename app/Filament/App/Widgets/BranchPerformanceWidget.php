<?php

namespace App\Filament\App\Widgets;

use App\Models\Branch;
use App\Models\Loan;
use App\Models\LoanScheduleItem;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder;

class BranchPerformanceWidget extends TableWidget
{
    protected static ?int $sort = 4;
    protected int|string|array $columnSpan = 'full';
    protected static ?string $heading = 'Branch Performance';

    public function table(Table $table): Table
    {
        return $table
            ->query(Branch::query())
            ->columns([
                TextColumn::make('name')->label('Branch')->sortable(),
                TextColumn::make('active_loans_count')
                    ->label('Active Loans')
                    ->getStateUsing(fn (Branch $record) =>
                        Loan::where('branch_id', $record->id)->where('status', 'active')->count()
                    )
                    ->alignEnd(),
                TextColumn::make('outstanding')
                    ->label('Outstanding (MK)')
                    ->getStateUsing(fn (Branch $record) =>
                        number_format(
                            (float) LoanScheduleItem::whereHas(
                                'loan',
                                fn ($q) => $q->where('branch_id', $record->id)->where('status', 'active')
                            )->selectRaw('COALESCE(SUM(principal_due - principal_paid), 0)')->value('coalesce') ?? 0,
                            0
                        )
                    )
                    ->alignEnd(),
                TextColumn::make('par30')
                    ->label('PAR 30')
                    ->getStateUsing(function (Branch $record) {
                        $active = Loan::where('branch_id', $record->id)->where('status', 'active')->count();
                        if ($active === 0) return '0%';
                        $par = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
                            ->where('due_date', '<', now()->subDays(30))
                            ->whereHas('loan', fn ($q) => $q->where('branch_id', $record->id)->where('status', 'active'))
                            ->distinct('loan_id')->count('loan_id');
                        return round(($par / $active) * 100, 1) . '%';
                    })
                    ->badge()
                    ->color(fn ($state) => (float) $state > 10 ? 'danger' : ((float) $state > 5 ? 'warning' : 'success')),
            ])
            ->paginated(false);
    }
}
