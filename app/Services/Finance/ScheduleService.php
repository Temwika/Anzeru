<?php

namespace App\Services\Finance;

use InvalidArgumentException;

class ScheduleService
{
    private const S = 20;

    /**
     * Generate a full amortisation schedule.
     *
     * @param array{
     *   principal: string,
     *   annualRatePct: string,
     *   interestMethod: string,
     *   frequency: string,
     *   term: int,
     *   startDate: string,
     *   processingFeePct?: string,
     * } $input
     */
    public static function generate(array $input): array
    {
        $M = MoneyHelper::class;
        $D = DateHelper::class;

        $principal = $M::round2((string) $input['principal']);
        $n = (int) $input['term'];
        $method = $input['interestMethod'];
        $frequency = $input['frequency'];
        $ratePct = (string) $input['annualRatePct'];
        $start = $input['startDate'];
        $feePct = (string) ($input['processingFeePct'] ?? '0');

        if ($n < 1) throw new InvalidArgumentException('Term must be a positive integer');
        if (!$M::isPositive($principal)) throw new InvalidArgumentException('Principal must be > 0');

        $ppy = $D::periodsPerYear($frequency);

        // Periodic rate (or flat-term per-instalment rate)
        if ($method === 'flat_term') {
            $r = bcdiv(bcdiv($ratePct, '100', self::S), (string) $n, self::S);
        } else {
            $r = bcdiv(bcdiv($ratePct, '100', self::S), (string) $ppy, self::S);
        }

        $rows = [];

        if ($method === 'reducing_balance') {
            $a = self::annuityInstallment($principal, $r, $n);
            $balance = $principal;
            for ($k = 1; $k <= $n; $k++) {
                $interest = $M::round2(bcmul($balance, $r, self::S));
                $princ = $k === $n
                    ? $balance
                    : $M::max('0', $M::min(bcsub($a, $interest, self::S), $balance));
                $rows[] = ['principal' => $princ, 'interest' => $interest];
                $balance = bcsub($balance, $princ, self::S);
            }
        } elseif ($method === 'flat' || $method === 'flat_term') {
            $years = $method === 'flat'
                ? bcdiv((string) $n, (string) $ppy, self::S)
                : '1';
            $totalInterest = $M::round2(bcmul(bcmul($principal, bcdiv($ratePct, '100', self::S), self::S), $years, self::S));
            $perInterest = $M::round2(bcdiv($totalInterest, (string) $n, self::S));
            $perPrincipal = $M::round2(bcdiv($principal, (string) $n, self::S));
            for ($k = 1; $k <= $n; $k++) {
                $last = $k === $n;
                $rows[] = [
                    'principal' => $last
                        ? bcsub($principal, bcmul($perPrincipal, (string) ($n - 1), self::S), self::S)
                        : $perPrincipal,
                    'interest' => $last
                        ? bcsub($totalInterest, bcmul($perInterest, (string) ($n - 1), self::S), self::S)
                        : $perInterest,
                ];
            }
        } else { // interest_only
            $interest = $M::round2(bcmul($principal, $r, self::S));
            for ($k = 1; $k <= $n; $k++) {
                $rows[] = ['principal' => $k === $n ? $principal : '0', 'interest' => $interest];
            }
        }

        $opening = $principal;
        $installments = [];
        foreach ($rows as $i => $row) {
            $closing = bcsub($opening, $row['principal'], self::S);
            $installments[] = [
                'no'             => $i + 1,
                'dueDate'        => $D::dueDate($start, $frequency, $i + 1),
                'openingBalance' => $M::m($opening),
                'principal'      => $M::m($row['principal']),
                'interest'       => $M::m($row['interest']),
                'total'          => $M::m(bcadd($row['principal'], $row['interest'], self::S)),
                'closingBalance' => $M::m($closing),
            ];
            $opening = $closing;
        }

        $totalInterest = $M::sum(array_column($installments, 'interest'));
        $processingFee = $M::round2(bcdiv(bcmul($principal, $feePct, self::S), '100', self::S));
        $netDisbursed = bcsub($principal, $processingFee, self::S);

        return [
            'installments'       => $installments,
            'periodicRatePct'    => rtrim(rtrim(bcmul($r, '100', 6), '0'), '.'),
            'totals'             => [
                'principal' => $M::m($principal),
                'interest'  => $M::m($totalInterest),
                'repayable' => $M::m(bcadd($principal, $totalInterest, self::S)),
            ],
            'processingFee'      => $M::m($processingFee),
            'netDisbursed'       => $M::m($netDisbursed),
            'installmentAmount'  => $installments[0]['total'],
            'disclosure'         => self::costOfCredit(
                $netDisbursed,
                array_column($installments, 'total'),
                $frequency,
            ),
        ];
    }

    /** Standard annuity A = P·r·(1+r)^n / ((1+r)^n − 1), rounded to 2dp. */
    private static function annuityInstallment(string $p, string $r, int $n): string
    {
        $M = MoneyHelper::class;
        if ($M::isZero($r)) {
            return $M::round2(bcdiv($p, (string) $n, self::S));
        }
        $growth = bcpow(bcadd('1', $r, self::S), (string) $n, self::S);
        $num = bcmul(bcmul($p, $r, self::S), $growth, self::S);
        $den = bcsub($growth, '1', self::S);
        return $M::round2(bcdiv($num, $den, self::S));
    }

    /**
     * APR and EAR via binary search on the periodic IRR.
     * Matches the TypeScript costOfCredit() exactly.
     */
    private static function costOfCredit(string $netDisbursed, array $payments, string $frequency): array
    {
        $M = MoneyHelper::class;
        $ppy = DateHelper::periodsPerYear($frequency);
        $net = $netDisbursed;

        if (!$M::isPositive($net)) return ['aprPct' => '0.00', 'effectiveAnnualRatePct' => '0.00'];
        $sumPay = $M::sum($payments);
        if ($M::lte($sumPay, $net)) return ['aprPct' => '0.00', 'effectiveAnnualRatePct' => '0.00'];

        $pv = function (string $i) use ($payments, $M): string {
            $acc = '0';
            foreach ($payments as $k => $cf) {
                $exp = $k + 1;
                $denom = bcpow(bcadd('1', $i, self::S), (string) $exp, self::S);
                $acc = bcadd($acc, bcdiv($cf, $denom, self::S), self::S);
            }
            return $acc;
        };

        $lo = '0';
        $hi = '1';
        while ($M::gt($pv($hi), $net) && $M::lt($hi, '1000')) {
            $hi = bcmul($hi, '2', self::S);
        }
        for ($iter = 0; $iter < 200; $iter++) {
            $mid = bcdiv(bcadd($lo, $hi, self::S), '2', self::S);
            if ($M::gt($pv($mid), $net)) {
                $lo = $mid;
            } else {
                $hi = $mid;
            }
            if ($M::lt(bcsub($hi, $lo, self::S), '0.000000000001')) break;
        }

        $i = bcdiv(bcadd($lo, $hi, self::S), '2', self::S);
        $aprRaw = bcmul(bcmul($i, (string) $ppy, self::S), '100', self::S);
        $earRaw = bcmul(bcsub(bcpow(bcadd('1', $i, self::S), (string) $ppy, self::S), '1', self::S), '100', self::S);

        return [
            'aprPct'              => number_format((float) $aprRaw, 2, '.', ''),
            'effectiveAnnualRatePct' => number_format((float) $earRaw, 2, '.', ''),
        ];
    }
}
