<?php

namespace Tests\Unit\Finance;

use App\Services\Finance\MoneyHelper as M;
use App\Services\Finance\ScheduleService;
use App\Services\Finance\ServicingService;
use PHPUnit\Framework\TestCase;

class ScheduleTest extends TestCase
{
    // ── Schedule generation ──────────────────────────────────────────────────

    public function test_reducing_balance_monthly(): void
    {
        $s = ScheduleService::generate([
            'principal'      => '10000',
            'annualRatePct'  => '36',
            'interestMethod' => 'reducing_balance',
            'frequency'      => 'monthly',
            'term'           => 12,
            'startDate'      => '2025-01-01',
        ]);
        // Principal repaid must equal disbursed amount
        $this->assertEquals('10000.00', $s['totals']['principal']);
        $this->assertCount(12, $s['installments']);
        // Final closing balance must be zero
        $last = end($s['installments']);
        $this->assertEquals('0.00', $last['closingBalance']);
        // Each installment should have consistent total = principal + interest
        foreach ($s['installments'] as $inst) {
            $sum = M::m(bcadd($inst['principal'], $inst['interest'], 20));
            $this->assertEquals($inst['total'], $sum);
        }
    }

    public function test_flat_monthly(): void
    {
        $s = ScheduleService::generate([
            'principal'      => '5000',
            'annualRatePct'  => '24',
            'interestMethod' => 'flat',
            'frequency'      => 'monthly',
            'term'           => 6,
            'startDate'      => '2025-01-01',
        ]);
        $this->assertEquals('5000.00', $s['totals']['principal']);
        // Flat: total interest = principal * rate * years = 5000 * 0.24 * 0.5 = 600
        $this->assertEquals('600.00', $s['totals']['interest']);
        $last = end($s['installments']);
        $this->assertEquals('0.00', $last['closingBalance']);
    }

    public function test_flat_term_daily(): void
    {
        // Marketeers: K500, 40% of principal, 28 instalments daily
        $s = ScheduleService::generate([
            'principal'      => '500',
            'annualRatePct'  => '40',
            'interestMethod' => 'flat_term',
            'frequency'      => 'daily',
            'term'           => 28,
            'startDate'      => '2025-01-01',
        ]);
        $this->assertEquals('500.00', $s['totals']['principal']);
        // Total interest = 500 * 40/100 = 200
        $this->assertEquals('200.00', $s['totals']['interest']);
        $this->assertCount(28, $s['installments']);
    }

    public function test_interest_only_monthly(): void
    {
        $s = ScheduleService::generate([
            'principal'      => '20000',
            'annualRatePct'  => '30',
            'interestMethod' => 'interest_only',
            'frequency'      => 'monthly',
            'term'           => 6,
            'startDate'      => '2025-01-01',
        ]);
        // Only last instalment has principal
        for ($i = 0; $i < 5; $i++) {
            $this->assertEquals('0.00', $s['installments'][$i]['principal']);
        }
        $this->assertEquals('20000.00', $s['installments'][5]['principal']);
        $last = end($s['installments']);
        $this->assertEquals('0.00', $last['closingBalance']);
    }

    // ── Allocation waterfall ─────────────────────────────────────────────────

    public function test_allocate_waterfall_order(): void
    {
        $items = [[
            'id' => 'i1', 'installmentNo' => 1, 'dueDate' => '2025-01-31',
            'due'  => ['penalty' => '50', 'fee' => '30', 'interest' => '100', 'principal' => '500'],
            'paid' => ['penalty' => '0',  'fee' => '0',  'interest' => '0',   'principal' => '0'],
        ]];

        $result = ServicingService::allocate('200', $items);

        $comps = array_column($result['allocations'], 'component');
        // Must see penalty then fee then interest in that order
        $this->assertContains('penalty', $comps);
        $penaltyIdx = array_search('penalty', $comps);
        $feeIdx     = array_search('fee', $comps);
        $interestIdx = array_search('interest', $comps);
        $this->assertLessThan($feeIdx, $penaltyIdx);
        $this->assertLessThan($interestIdx, $feeIdx);
        // Penalty fully paid, fee fully paid, interest partially
        $by = $result['byComponent'];
        $this->assertEquals('50.00', $by['penalty']);
        $this->assertEquals('30.00', $by['fee']);
        $this->assertEquals('100.00', $by['interest']); // capped at outstanding
        $this->assertEquals('20.00', $by['principal']); // remainder flows to principal
        $this->assertEquals('0.00', $result['unallocated']);
    }

    // ── Position / ageing ────────────────────────────────────────────────────

    public function test_position_bucket_90plus(): void
    {
        $items = [[
            'id' => 'i1', 'installmentNo' => 1, 'dueDate' => '2025-01-01',
            'due'  => ['penalty' => '0', 'fee' => '0', 'interest' => '50', 'principal' => '200'],
            'paid' => ['penalty' => '0', 'fee' => '0', 'interest' => '0',  'principal' => '0'],
        ]];

        // asOf is 100 days after due date → DPD=100 → bucket=90+
        $pos = ServicingService::position($items, '2025-04-11');
        $this->assertEquals('90+', $pos['bucket']);
        $this->assertGreaterThan(90, $pos['daysPastDue']);
        $this->assertEquals('200.00', $pos['principalOutstanding']);
    }

    public function test_position_current(): void
    {
        $items = [[
            'id' => 'i1', 'installmentNo' => 1, 'dueDate' => '2025-06-01',
            'due'  => ['penalty' => '0', 'fee' => '0', 'interest' => '50', 'principal' => '200'],
            'paid' => ['penalty' => '0', 'fee' => '0', 'interest' => '0',  'principal' => '0'],
        ]];
        $pos = ServicingService::position($items, '2025-01-01');
        $this->assertEquals('current', $pos['bucket']);
        $this->assertEquals(0, $pos['daysPastDue']);
        $this->assertFalse($pos['paidOff']);
    }
}
