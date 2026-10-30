<?php

namespace App\Filament\App\Widgets;

use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanScheduleItem;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;

class LoanStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $total     = Loan::where('status', 'active')->count();
        $principal = Loan::where('status', 'active')->sum('principal');

        // Outstanding = unpaid principal across active loans' schedules
        $outstanding = LoanScheduleItem::whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->selectRaw('SUM(principal_due - principal_paid)')
            ->value('sum') ?? 0;

        // PAR 30: loans with at least one installment >30 days overdue
        $par30Loans = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', now()->subDays(30))
            ->distinct('loan_id')
            ->count('loan_id');

        $par30Pct = $total > 0 ? round(($par30Loans / $total) * 100, 1) : 0;

        // Pending applications
        $pendingApps = LoanApplication::where('status', 'submitted')->count();

        return [
            Stat::make('Active Loans', number_format($total))
                ->description("{$pendingApps} pending review")
                ->color($pendingApps > 0 ? 'warning' : 'success')
                ->icon('heroicon-o-banknotes'),

            Stat::make('Outstanding Balance', 'MK ' . number_format((float) $outstanding, 2))
                ->description('Principal: MK ' . number_format((float) $principal, 2))
                ->color('primary')
                ->icon('heroicon-o-currency-dollar'),

            Stat::make('PAR 30', "{$par30Pct}%")
                ->description("{$par30Loans} loans past 30 days")
                ->color($par30Pct > 5 ? 'danger' : ($par30Pct > 2 ? 'warning' : 'success'))
                ->icon('heroicon-o-exclamation-triangle'),
        ];
    }
}
