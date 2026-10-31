<?php

namespace App\Filament\App\Widgets;

use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDisbursement;
use App\Models\LoanScheduleItem;
use App\Models\Payment;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;

class LoanStatsWidget extends StatsOverviewWidget
{
    protected static ?int $sort = 1;
    protected static ?string $pollingInterval = null;

    protected function getStats(): array
    {
        $now   = Carbon::now();
        $som   = $now->copy()->startOfMonth();
        $total = Loan::where('status', 'active')->count();

        // Outstanding principal (unpaid)
        $outstanding = LoanScheduleItem::whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->selectRaw('COALESCE(SUM(principal_due - principal_paid), 0)')
            ->value('coalesce') ?? 0;

        // PAR 30 & PAR 90
        $par30Loans = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $now->copy()->subDays(30))
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->distinct('loan_id')->count('loan_id');
        $par90Loans = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $now->copy()->subDays(90))
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->distinct('loan_id')->count('loan_id');

        $par30Pct = $total > 0 ? round(($par30Loans / $total) * 100, 1) : 0;
        $par90Pct = $total > 0 ? round(($par90Loans / $total) * 100, 1) : 0;

        // Loans in arrears (any overdue installment)
        $inArrears = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $now)
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->distinct('loan_id')->count('loan_id');

        $overdueAmount = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $now)
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->selectRaw('COALESCE(SUM(principal_due + interest_due + penalty_due - principal_paid - interest_paid - penalty_paid), 0)')
            ->value('coalesce') ?? 0;

        // This month
        $disbursedMonth = LoanDisbursement::where('status', 'completed')
            ->whereBetween('value_date', [$som, $now])
            ->sum('net_amount');
        $collectedMonth = Payment::where('status', 'posted')
            ->whereBetween('received_on', [$som, $now])
            ->sum('amount');
        $dueMonth = LoanScheduleItem::whereBetween('due_date', [$som, $now])
            ->selectRaw('COALESCE(SUM(principal_due + interest_due + fee_due), 0)')
            ->value('coalesce') ?? 0;

        $efficiency = $dueMonth > 0 ? min(200, round(($collectedMonth / $dueMonth) * 100, 1)) : null;

        // Pending applications
        $pendingApps = LoanApplication::where('status', 'submitted')->count();

        $fmt = fn ($v) => 'MK ' . number_format((float) $v, 0);

        return [
            Stat::make('Active Loans', number_format($total))
                ->description("{$pendingApps} pending review · {$inArrears} in arrears")
                ->color($pendingApps > 0 ? 'warning' : 'success')
                ->icon('heroicon-o-banknotes'),

            Stat::make('Outstanding Principal', $fmt($outstanding))
                ->description('Overdue: ' . $fmt($overdueAmount))
                ->color('primary')
                ->icon('heroicon-o-building-library'),

            Stat::make('Collected this month', $fmt($collectedMonth))
                ->description(
                    $efficiency === null
                        ? 'Nothing due yet this month'
                        : "{$efficiency}% of {$fmt($dueMonth)} due so far"
                )
                ->color($efficiency === null ? 'gray' : ($efficiency >= 90 ? 'success' : ($efficiency >= 70 ? 'warning' : 'danger')))
                ->icon('heroicon-o-wallet'),

            Stat::make('Disbursed this month', $fmt($disbursedMonth))
                ->description($fmt($outstanding) . ' total outstanding')
                ->color('info')
                ->icon('heroicon-o-arrow-up-right'),

            Stat::make('PAR 30', "{$par30Pct}%")
                ->description("PAR 90: {$par90Pct}% · {$par30Loans} loans")
                ->color($par30Pct > 10 ? 'danger' : ($par30Pct > 5 ? 'warning' : 'success'))
                ->icon('heroicon-o-exclamation-triangle'),
        ];
    }
}
