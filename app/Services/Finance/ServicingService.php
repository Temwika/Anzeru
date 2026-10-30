<?php

namespace App\Services\Finance;

use InvalidArgumentException;

class ServicingService
{
    private const COMPONENTS = ['penalty', 'fee', 'interest', 'principal'];
    private const S = 20;

    /**
     * Each item: ['id', 'installmentNo', 'dueDate', 'due' => [...], 'paid' => [...]]
     * where due/paid each have keys: penalty, fee, interest, principal.
     */
    private static function outstandingOf(array $item): array
    {
        $M = MoneyHelper::class;
        $out = [];
        foreach (self::COMPONENTS as $c) {
            $diff = bcsub((string) ($item['due'][$c] ?? '0'), (string) ($item['paid'][$c] ?? '0'), self::S);
            $out[$c] = $M::max('0', $diff);
        }
        return $out;
    }

    private static function outstandingTotal(array $item): string
    {
        $out = self::outstandingOf($item);
        return MoneyHelper::sum(array_values($out));
    }

    private static function sortItems(array $items): array
    {
        usort($items, fn($a, $b) => strcmp($a['dueDate'], $b['dueDate']) ?: $a['installmentNo'] <=> $b['installmentNo']);
        return $items;
    }

    /**
     * Waterfall allocation: penalty → fee → interest → principal, oldest first.
     * Returns allocations[], unallocated string, and byComponent totals.
     */
    public static function allocate(string $amount, array $items): array
    {
        $M = MoneyHelper::class;
        $remaining = $M::round2($amount);
        if (!$M::isPositive($remaining)) throw new InvalidArgumentException('Payment amount must be > 0');

        $allocations = [];
        $by = array_fill_keys(self::COMPONENTS, '0');

        foreach (self::sortItems($items) as $item) {
            if (!$M::isPositive($remaining)) break;
            $out = self::outstandingOf($item);
            foreach (self::COMPONENTS as $c) {
                if (!$M::isPositive($remaining)) break;
                $take = $M::min($out[$c], $remaining);
                if ($M::isPositive($take)) {
                    $allocations[] = [
                        'itemId'        => $item['id'],
                        'installmentNo' => $item['installmentNo'],
                        'component'     => $c,
                        'amount'        => $M::m($take),
                    ];
                    $by[$c] = bcadd($by[$c], $take, self::S);
                    $remaining = bcsub($remaining, $take, self::S);
                }
            }
        }

        return [
            'allocations'  => $allocations,
            'unallocated'  => $M::m($remaining),
            'byComponent'  => array_map(fn($v) => $M::m($v), $by),
        ];
    }

    /** Loan position as at a calendar date. Instalment is overdue if dueDate < asOf. */
    public static function position(array $items, string $asOf): array
    {
        $M = MoneyHelper::class;
        $D = DateHelper::class;

        $totals = array_fill_keys(self::COMPONENTS, '0');
        $overdue = '0';
        $overdueCount = 0;
        $oldestOverdue = null;
        $next = null;

        foreach (self::sortItems($items) as $item) {
            $out = self::outstandingOf($item);
            foreach (self::COMPONENTS as $c) {
                $totals[$c] = bcadd($totals[$c], $out[$c], self::S);
            }
            $itemTotal = $M::sum(array_values($out));
            if (!$M::isPositive($itemTotal)) continue;
            if ($item['dueDate'] < $asOf) {
                $overdue = bcadd($overdue, $itemTotal, self::S);
                $overdueCount++;
                $oldestOverdue ??= $item['dueDate'];
            } elseif ($next === null) {
                $next = $item;
            }
        }

        $dpd = $oldestOverdue ? $D::daysBetween($oldestOverdue, $asOf) : 0;
        $total = $M::sum(array_values($totals));

        return [
            'principalOutstanding' => $M::m($totals['principal']),
            'interestOutstanding'  => $M::m($totals['interest']),
            'feesOutstanding'      => $M::m($totals['fee']),
            'penaltiesOutstanding' => $M::m($totals['penalty']),
            'totalOutstanding'     => $M::m($total),
            'overdueAmount'        => $M::m($overdue),
            'overdueInstallments'  => $overdueCount,
            'daysPastDue'          => $dpd,
            'bucket'               => self::ageingBucket($dpd),
            'nextDueDate'          => $next ? $next['dueDate'] : null,
            'nextDueAmount'        => $next ? $M::m(self::outstandingTotal($next)) : '0.00',
            'paidOff'              => $M::lte($total, '0'),
        ];
    }

    public static function ageingBucket(int $dpd): string
    {
        if ($dpd <= 0) return 'current';
        if ($dpd <= 30) return '1-30';
        if ($dpd <= 60) return '31-60';
        if ($dpd <= 90) return '61-90';
        return '90+';
    }

    /**
     * Settlement quote: principal + charges due + current period interest.
     * Future interest (beyond next period) is waived.
     */
    public static function settlementQuote(array $items, string $asOf): array
    {
        $M = MoneyHelper::class;
        $principal = '0';
        $interest = '0';
        $fees = '0';
        $penalties = '0';
        $waived = '0';
        $currentCounted = false;

        foreach (self::sortItems($items) as $item) {
            $out = self::outstandingOf($item);
            $principal  = bcadd($principal, $out['principal'], self::S);
            $penalties  = bcadd($penalties, $out['penalty'], self::S);
            $fees       = bcadd($fees, $out['fee'], self::S);
            if ($item['dueDate'] <= $asOf) {
                $interest = bcadd($interest, $out['interest'], self::S);
            } elseif (!$currentCounted) {
                $interest = bcadd($interest, $out['interest'], self::S);
                $currentCounted = true;
            } else {
                $waived = bcadd($waived, $out['interest'], self::S);
            }
        }

        $total = $M::sum([$principal, $interest, $fees, $penalties]);
        return [
            'asOf'           => $asOf,
            'principal'      => $M::m($principal),
            'interest'       => $M::m($interest),
            'fees'           => $M::m($fees),
            'penalties'      => $M::m($penalties),
            'total'          => $M::m($total),
            'interestWaived' => $M::m($waived),
            'rule'           => 'Outstanding principal + charges due to date + current-period interest; later interest waived.',
        ];
    }

    /** Per-instalment interest waivers for future periods beyond next. */
    public static function settlementWaivers(array $items, string $asOf): array
    {
        $M = MoneyHelper::class;
        $waivers = [];
        $currentCounted = false;
        foreach (self::sortItems($items) as $item) {
            if ($item['dueDate'] <= $asOf) continue;
            if (!$currentCounted) { $currentCounted = true; continue; }
            $interest = self::outstandingOf($item)['interest'];
            if ($M::isPositive($interest)) {
                $waivers[] = ['itemId' => $item['id'], 'installmentNo' => $item['installmentNo'], 'interest' => $M::m($interest)];
            }
        }
        return $waivers;
    }

    public static function latePenalty(string $overdueAmount, string $penaltyPct): string
    {
        return MoneyHelper::m(bcdiv(bcmul($overdueAmount, $penaltyPct, self::S), '100', self::S));
    }

    public static function assessAffordability(array $input): array
    {
        $M = MoneyHelper::class;
        $D = DateHelper::class;

        $income = (string) $input['monthlyIncome'];
        $ppy = $D::periodsPerYear($input['frequency']);
        $monthlyInstallment = $M::round2(bcdiv(bcmul((string) $input['installment'], (string) $ppy, self::S), '12', self::S));
        $debt = bcadd((string) $input['existingDebtRepayments'], $monthlyInstallment, self::S);
        $dti = $M::isPositive($income)
            ? bcdiv(bcmul($debt, '100', self::S), $income, self::S)
            : '999';
        $disposable = bcsub(bcsub($income, (string) $input['monthlyExpenses'], self::S), (string) $input['existingDebtRepayments'], self::S);
        $after = bcsub($disposable, $monthlyInstallment, self::S);

        return [
            'monthlyInstallment'         => $M::m($monthlyInstallment),
            'debtToIncomePct'            => number_format((float) $dti, 2, '.', ''),
            'disposableIncome'           => $M::m($disposable),
            'disposableAfterInstallment' => $M::m($after),
            'withinDtiPolicy'            => $M::lte($dti, (string) $input['maxDtiPct']),
            'positiveDisposable'         => $M::isPositive($after),
        ];
    }
}
