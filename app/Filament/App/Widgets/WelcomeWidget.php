<?php

namespace App\Filament\App\Widgets;

use App\Filament\App\Pages\ApprovalsPage;
use App\Filament\App\Resources\CustomerResource;
use App\Filament\App\Resources\LoanApplicationResource;
use App\Filament\App\Resources\LoanResource;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDisbursement;
use App\Models\LoanScheduleItem;
use Filament\Widgets\Widget;
use Illuminate\Support\Carbon;

/** The navy welcome band: a greeting, three headline figures and what needs doing today. */
class WelcomeWidget extends Widget
{
    protected static ?int $sort = 0;
    protected static string $view = 'filament.app.widgets.welcome';
    protected int|string|array $columnSpan = 'full';

    protected function getViewData(): array
    {
        // Staff are in Zambia; the app clock runs on UTC.
        $now = Carbon::now('Africa/Lusaka');
        $user = auth()->user();
        $first = strtok((string) ($user?->full_name ?? ''), ' ') ?: 'there';
        $greeting = $now->hour < 12 ? 'Good morning' : ($now->hour < 17 ? 'Good afternoon' : 'Good evening');

        $active = fn ($q) => $q->where('status', 'active');
        $outstanding = (float) (LoanScheduleItem::whereHas('loan', $active)
            ->selectRaw('COALESCE(SUM(principal_due - principal_paid), 0) as total')->value('total') ?? 0);
        $lateItems = LoanScheduleItem::whereColumn('principal_paid', '<', 'principal_due')
            ->where('due_date', '<', now())->whereHas('loan', $active);
        $arrearsLoans = (clone $lateItems)->distinct()->count('loan_id');
        $overdue = (float) ((clone $lateItems)
            ->selectRaw('COALESCE(SUM(principal_due + interest_due + penalty_due - principal_paid - interest_paid - penalty_paid), 0) as total')
            ->value('total') ?? 0);

        $applications = LoanApplication::where('status', 'submitted')->count();
        $payouts = LoanDisbursement::where('status', 'requested')->count();
        $kyc = Customer::where('kyc_status', 'pending')->count();

        $k = fn (float $v) => $v >= 1_000_000 ? 'K' . number_format($v / 1_000_000, 2) . 'M' : ($v >= 10_000 ? 'K' . number_format($v / 1000, 0) . 'K' : 'K' . number_format($v, 0));
        $plural = fn (int $n, string $one, string $many) => $n === 1 ? $one : $many;

        $steps = array_values(array_filter([
            $applications ? ['icon' => 'heroicon-o-document-check', 'urgent' => true, 'title' => "Decide {$applications} " . $plural($applications, 'application', 'applications'), 'body' => 'Scored and waiting for a credit decision', 'url' => LoanApplicationResource::getUrl()] : null,
            $payouts ? ['icon' => 'heroicon-o-banknotes', 'urgent' => true, 'title' => "Authorise {$payouts} " . $plural($payouts, 'payout', 'payouts'), 'body' => 'Approved loans waiting to be paid out', 'url' => ApprovalsPage::getUrl()] : null,
            $kyc ? ['icon' => 'heroicon-o-identification', 'urgent' => true, 'title' => "Verify {$kyc} " . $plural($kyc, 'customer', 'customers'), 'body' => 'KYC documents waiting for review', 'url' => CustomerResource::getUrl()] : null,
            $arrearsLoans ? ['icon' => 'heroicon-o-bell-alert', 'urgent' => false, 'title' => "Follow up {$arrearsLoans} " . $plural($arrearsLoans, 'loan', 'loans') . ' in arrears', 'body' => $k($overdue) . ' overdue across the book', 'url' => LoanResource::getUrl()] : null,
        ]));

        return [
            'greeting' => "{$greeting}, {$first}.",
            'date' => $now->format('l, j F Y'),
            'waiting' => $applications + $payouts + $kyc,
            'stats' => [
                ['label' => 'Active loans', 'value' => number_format(Loan::where('status', 'active')->count())],
                ['label' => 'Portfolio', 'value' => $k($outstanding)],
                ['label' => 'In arrears', 'value' => number_format($arrearsLoans), 'accent' => $arrearsLoans > 0],
            ],
            'steps' => array_slice($steps, 0, 4),
        ];
    }
}
