<?php

namespace App\Filament\App\Widgets;

use App\Models\LoanDisbursement;
use App\Models\Payment;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

/** Money out against money in, month by month: the first thing a lender's board asks to see. */
class CashFlowChart extends ChartWidget
{
    protected static ?int $sort = 2;
    protected static ?string $heading = 'Disbursements and collections';
    protected static ?string $description = 'Last six months, by value date';
    protected static ?string $maxHeight = '260px';
    protected static ?string $pollingInterval = null;

    protected function getData(): array
    {
        $labels = $out = $in = [];
        for ($i = 5; $i >= 0; $i--) {
            $start = Carbon::now()->startOfMonth()->subMonths($i);
            $end = $start->copy()->endOfMonth();
            $labels[] = $start->format('M');
            $out[] = round((float) LoanDisbursement::where('status', 'completed')->whereBetween('value_date', [$start, $end])->sum('net_amount'), 2);
            $in[] = round((float) Payment::where('status', 'posted')->whereBetween('received_on', [$start, $end])->sum('amount'), 2);
        }

        return [
            'labels' => $labels,
            'datasets' => [
                ['label' => 'Disbursed', 'data' => $out, 'backgroundColor' => '#2f6be0', 'borderColor' => '#2f6be0', 'borderWidth' => 0, 'borderRadius' => 6, 'maxBarThickness' => 26],
                ['label' => 'Collected', 'data' => $in, 'backgroundColor' => '#f26b1d', 'borderColor' => '#f26b1d', 'borderWidth' => 0, 'borderRadius' => 6, 'maxBarThickness' => 26],
            ],
        ];
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => ['legend' => ['position' => 'bottom', 'labels' => ['usePointStyle' => true, 'boxWidth' => 8]]],
            'scales' => [
                'x' => ['grid' => ['display' => false]],
                'y' => ['beginAtZero' => true, 'ticks' => ['maxTicksLimit' => 5]],
            ],
        ];
    }
}
