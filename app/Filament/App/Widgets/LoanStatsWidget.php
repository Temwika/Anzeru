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

        // Sums are read by alias: an unnamed COALESCE(...) column is called "coalesce" only on
        // PostgreSQL, so on MySQL every total used to come back as zero.
        $sum = fn ($query, string $expr) => (float) ($query->selectRaw("COALESCE(SUM({$expr}), 0) as total")->value('total') ?? 0);
        $active = fn ($q) => $q->where('status', 'active');

        // Outstanding principal (unpaid)
        $outstanding = $sum(LoanScheduleItem::whereHas('loan', $active), 'principal_due - principal_paid');

        // Portfolio at risk, the industry measure: the whole outstanding principal of every loan
        // with an instalment more than N days late, as a share of all outstanding principal.
        $atRisk = function (int $days) use ($now, $active, $sum) {
            $late = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
                ->where('due_date', '<', $now->copy()->subDays($days))
                ->whereHas('loan', $active)
                ->distinct()->pluck('loan_id');

            return [$late->count(), $late->isEmpty() ? 0.0 : $sum(LoanScheduleItem::whereIn('loan_id', $late), 'principal_due - principal_paid')];
        };
        [$par30Loans, $par30Amount] = $atRisk(30);
        [, $par90Amount] = $atRisk(90);

        $par30Pct = $outstanding > 0 ? round(($par30Amount / $outstanding) * 100, 1) : 0;
        $par90Pct = $outstanding > 0 ? round(($par90Amount / $outstanding) * 100, 1) : 0;

        // Loans in arrears (any overdue installment)
        $inArrears = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $now)
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->distinct('loan_id')->count('loan_id');

        $overdueAmount = $sum(
            LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')->where('due_date', '<', $now)->whereHas('loan', $active),
            'principal_due + interest_due + penalty_due - principal_paid - interest_paid - penalty_paid',
        );

        // This month
        $disbursedMonth = LoanDisbursement::where('status', 'completed')
            ->whereBetween('value_date', [$som, $now])
            ->sum('net_amount');
        $collectedMonth = Payment::where('status', 'posted')
            ->whereBetween('received_on', [$som, $now])
            ->sum('amount');
        $dueMonth = $sum(LoanScheduleItem::whereBetween('due_date', [$som, $now]), 'principal_due + interest_due + fee_due');

        $efficiency = $dueMonth > 0 ? min(200, round(($collectedMonth / $dueMonth) * 100, 1)) : null;

        // Pending applications
        $pendingApps = LoanApplication::where('status', 'submitted')->count();

        $fmt = fn ($v) => 'K ' . number_format((float) $v, 0);

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
                ->description("{$fmt($par30Amount)} at risk · {$par30Loans} loans · PAR 90: {$par90Pct}%")
                ->color($par30Pct > 10 ? 'danger' : ($par30Pct > 5 ? 'warning' : 'success'))
                ->icon('heroicon-o-exclamation-triangle'),
        ];
    }
}
