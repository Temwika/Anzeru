<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalLine;
use Illuminate\Support\Str;

class LedgerService
{
    // Channel → asset account code
    private static array $channelAccounts = [
        'cash'         => '1001',
        'bank'         => '1002',
        'mtn_momo'     => '1003',
        'airtel_money' => '1004',
    ];

    public function postDisbursement(
        string $tenantId,
        string $loanId,
        string $disbursementId,
        string $channel,
        string $principal,
        string $fee,
        string $valueDate,
        string $postedBy
    ): JournalEntry {
        $ref = NumberingService::next('journal', $tenantId);

        $accounts = $this->accountMap($tenantId);
        $channelCode = self::$channelAccounts[$channel] ?? '1002';

        // DR Loans Receivable, CR cash/bank channel (principal only; fee stays in suspense)
        $lines = [
            ['account_code' => '1100', 'debit' => $principal, 'credit' => '0.00'],
            ['account_code' => $channelCode, 'debit' => '0.00', 'credit' => $principal],
        ];

        // Fee income posted immediately
        if (bccomp($fee, '0', 2) > 0) {
            $lines[] = ['account_code' => $channelCode, 'debit' => '0.00', 'credit' => $fee];
            $lines[] = ['account_code' => '4002', 'debit' => $fee, 'credit' => '0.00'];
        }

        return $this->post($tenantId, $ref, $valueDate, "Disbursement $ref for loan $loanId", $lines, $accounts, $postedBy, 'disbursement', $disbursementId);
    }

    public function postPayment(
        string $tenantId,
        string $loanId,
        string $paymentId,
        string $channel,
        string $principal,
        string $interest,
        string $penalty,
        string $fee,
        string $receivedOn,
        string $postedBy
    ): JournalEntry {
        $ref = NumberingService::next('journal', $tenantId);
        $accounts = $this->accountMap($tenantId);
        $channelCode = self::$channelAccounts[$channel] ?? '1002';

        $total = bcadd(bcadd(bcadd($principal, $interest, 2), $penalty, 2), $fee, 2);
        $lines = [
            ['account_code' => $channelCode, 'debit' => $total,     'credit' => '0.00'],
            ['account_code' => '1100',        'debit' => '0.00',     'credit' => $principal],
            ['account_code' => '4001',        'debit' => '0.00',     'credit' => $interest],
        ];
        if (bccomp($penalty, '0', 2) > 0) {
            $lines[] = ['account_code' => '4003', 'debit' => '0.00', 'credit' => $penalty];
        }
        if (bccomp($fee, '0', 2) > 0) {
            $lines[] = ['account_code' => '4002', 'debit' => '0.00', 'credit' => $fee];
        }

        return $this->post($tenantId, $ref, $receivedOn, "Payment $ref for loan $loanId", $lines, $accounts, $postedBy, 'payment', $paymentId);
    }

    private function post(
        string $tenantId,
        string $ref,
        string $date,
        string $description,
        array $lines,
        array $accountMap,
        string $postedBy,
        string $sourceType,
        string $sourceId
    ): JournalEntry {
        $entry = JournalEntry::create([
            'id'          => Str::uuid()->toString(),
            'tenant_id'   => $tenantId,
            'entry_number' => $ref,
            'entry_date'  => $date,
            'description' => $description,
            'source_type' => $sourceType,
            'source_id'   => $sourceId,
            'posted_by'   => $postedBy,
            'created_at'  => now(),
        ]);

        foreach ($lines as $line) {
            if (!isset($accountMap[$line['account_code']])) {
                continue; // skip if account not seeded
            }
            JournalLine::create([
                'id'         => Str::uuid()->toString(),
                'tenant_id'  => $tenantId,
                'entry_id'   => $entry->id,
                'account_id' => $accountMap[$line['account_code']],
                'debit'      => $line['debit'],
                'credit'     => $line['credit'],
                'description' => null,
            ]);
        }

        return $entry;
    }

    private function accountMap(string $tenantId): array
    {
        return ChartOfAccount::where('tenant_id', $tenantId)
            ->pluck('id', 'code')
            ->all();
    }
}
