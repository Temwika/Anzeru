<?php

namespace App\Filament\Borrower\Pages;

use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanScheduleItem;
use Filament\Pages\Page;

class BorrowerDashboard extends Page
{
    protected static ?string $navigationIcon = 'heroicon-o-home';
    protected static string $view = 'filament.borrower.pages.borrower-dashboard';
    protected static string $routePath = '/';
    protected static ?string $title = 'My Account';

    public ?Customer $customer = null;
    public array $activeLoans = [];
    public ?array $nextInstallment = null;

    public function mount(): void
    {
        $user = auth()->user();
        if ($user->customer_id) {
            $this->customer = Customer::find($user->customer_id);
        }

        if ($this->customer) {
            $loans = Loan::where('customer_id', $this->customer->id)
                ->whereIn('status', ['active', 'pending_disbursement'])
                ->with(['product'])
                ->get();

            $this->activeLoans = $loans->map(fn ($l) => [
                'id'          => $l->id,
                'loan_number' => $l->loan_number,
                'product'     => $l->product->name ?? '—',
                'principal'   => number_format($l->principal, 2),
                'outstanding' => number_format((float) $l->principal, 2),
                'status'      => $l->status,
            ])->toArray();

            // Find nearest unpaid installment across all active loans
            $next = LoanScheduleItem::whereIn('loan_id', $loans->pluck('id'))
                ->whereColumn('principal_paid', '<', 'principal_due')
                ->orderBy('due_date')
                ->first();

            if ($next) {
                $this->nextInstallment = [
                    'due_date'  => $next->due_date->format('d M Y'),
                    'total_due' => number_format($next->total_due, 2),
                    'loan_id'   => $next->loan_id,
                ];
            }
        }
    }
}
