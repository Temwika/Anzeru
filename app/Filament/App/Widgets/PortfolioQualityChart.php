<?php

namespace App\Filament\App\Widgets;

use App\Models\LoanScheduleItem;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

/** Outstanding principal by how late each loan is, from current to more than 90 days. */
class PortfolioQualityChart extends ChartWidget
{
    protected static ?int $sort = 2;
    protected static ?string $heading = 'Portfolio quality';
    protected static ?string $description = 'Outstanding principal by days past due';
    protected static ?string $maxHeight = '260px';
    protected static ?string $pollingInterval = null;

    /** Ordered light to dark so the ramp reads without colour; the legend names every band. */
    private const BUCKETS = [
        'Current' => '#0ca30c',
        '1–30 days' => '#fab219',
        '31–60 days' => '#ec835a',
        '61–90 days' => '#d03b3b',
        '90+ days' => '#8f1d1d',
    ];

    protected function getData(): array
    {
        $active = fn ($q) => $q->where('status', 'active');
        $owed = LoanScheduleItem::whereHas('loan', $active)
            ->selectRaw('loan_id, SUM(principal_due - principal_paid) as owed')
            ->groupBy('loan_id')->pluck('owed', 'loan_id');
        $oldestLate = LoanScheduleItem::whereHas('loan', $active)
            ->whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', now())
            ->selectRaw('loan_id, MIN(due_date) as oldest')
            ->groupBy('loan_id')->pluck('oldest', 'loan_id');

        $totals = array_fill_keys(array_keys(self::BUCKETS), 0.0);
        foreach ($owed as $loanId => $amount) {
            $days = isset($oldestLate[$loanId]) ? Carbon::parse($oldestLate[$loanId])->diffInDays(now()) : 0;
            $bucket = match (true) {
                $days <= 0 => 'Current',
                $days <= 30 => '1–30 days',
                $days <= 60 => '31–60 days',
                $days <= 90 => '61–90 days',
                default => '90+ days',
            };
            $totals[$bucket] += max(0, (float) $amount);
        }

        return [
            'labels' => array_keys($totals),
            'datasets' => [[
                'data' => array_map(fn ($v) => round($v, 2), array_values($totals)),
                'backgroundColor' => array_values(self::BUCKETS),
                'borderWidth' => 2,
                'borderColor' => 'rgba(255,255,255,0.9)',
                'hoverOffset' => 8,
            ]],
        ];
    }

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getOptions(): array
    {
        return [
            'cutout' => '68%',
            'plugins' => ['legend' => ['position' => 'right', 'labels' => ['usePointStyle' => true, 'boxWidth' => 8]]],
            'scales' => ['x' => ['display' => false], 'y' => ['display' => false]],
        ];
    }
}
