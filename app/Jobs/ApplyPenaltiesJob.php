<?php

namespace App\Jobs;

use App\Models\LoanScheduleItem;
use App\Services\Finance\MoneyHelper;
use Carbon\Carbon;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ApplyPenaltiesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $today = Carbon::today();

        // Overdue unpaid items with no penalty applied yet
        LoanScheduleItem::with('loan.product')
            ->whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', $today)
            ->whereNull('penalty_applied_at')
            ->whereHas('loan', fn ($q) => $q->where('status', 'active'))
            ->chunk(500, function ($items) use ($today) {
                foreach ($items as $item) {
                    $product = $item->loan->product;
                    if (!$product) continue;

                    $graceCutoff = Carbon::parse($item->due_date)->addDays($product->grace_days);
                    if ($today->lte($graceCutoff)) continue;

                    $outstanding = bcsub(
                        bcadd(bcadd($item->principal_due, $item->interest_due, 2), $item->fee_due, 2),
                        bcadd(bcadd($item->principal_paid, $item->interest_paid, 2), $item->fee_paid, 2),
                        2
                    );
                    $penalty = MoneyHelper::round2(
                        bcmul($outstanding, bcdiv((string) $product->penalty_pct, '100', 10), 10)
                    );

                    $item->update([
                        'penalty_due'        => bcadd($item->penalty_due, $penalty, 2),
                        'penalty_applied_at' => now(),
                    ]);
                }
            });
    }
}
