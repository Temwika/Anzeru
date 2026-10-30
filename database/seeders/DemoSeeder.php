<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\LoanProduct;
use App\Models\Tenant;
use App\Models\User;
use App\Models\UserBranchAccess;
use App\Services\Finance\ScheduleService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoSeeder extends Seeder
{
    private const PASSWORD = 'Demo2026!pass';

    private array $first = [
        'Chanda', 'Mwila', 'Bwalya', 'Mutale', 'Natasha', 'Kondwani', 'Thandiwe', 'Musonda',
        'Chilufya', 'Mapalo', 'Lubinda', 'Nalukui', 'Kalaba', 'Mulenga', 'Chipo', 'Kabwe',
        'Lweendo', 'Inonge', 'Mwansa', 'Zyambo', 'Namakau', 'Chisanga', 'Taonga', 'Chomba',
        'Mukuka', 'Precious', 'Sepo', 'Kasonde', 'Mubanga', 'Nchimunya', 'Chimwemwe',
        'Luyando', 'Mwape', 'Kunda', 'Malama', 'Chabala',
    ];
    private array $last = [
        'Banda', 'Phiri', 'Mwanza', 'Tembo', 'Zulu', 'Mulenga', 'Chileshe', 'Lungu',
        'Sakala', 'Mumba', 'Ngoma', 'Kaunda', 'Mwale', 'Daka', 'Chirwa', 'Siame',
        'Musonda', 'Hamoonga', 'Simukonda', 'Kapembwa',
    ];
    private array $employers = [
        'Ministry of Health', 'Zambia Revenue Authority', 'ZESCO Limited',
        'Copperbelt University', 'Lusaka City Council', 'Shoprite Zambia',
        'Zambia National Commercial Bank', 'Ministry of Education',
        null, null, null, null, null, null, null, null,
    ];
    private array $occupations = [
        'Civil Servant', 'Revenue Officer', 'Electrician', 'Lecturer', 'Clerk',
        'Shop Manager', 'Banker', 'Teacher',
        'Trader', 'Market Vendor', 'Farmer', 'Tailor', 'Mechanic', 'Shop Owner', 'Hawker', 'Fisher',
    ];

    private int $seed = 20261024;

    private function rand(): float
    {
        $this->seed = ($this->seed * 1664525 + 1013904223) % 4294967296;
        return $this->seed / 4294967296;
    }

    private function pick(array $xs): mixed
    {
        return $xs[(int) floor($this->rand() * count($xs))];
    }

    public function run(): void
    {
        DB::statement('SET session_replication_role = replica'); // disable FK checks temporarily

        $ph = Hash::make(self::PASSWORD);

        // --- Tenant ---
        $tenant = Tenant::create([
            'id' => Str::uuid()->toString(),
            'name' => 'Chilimbitso Money Lending',
            'code' => 'DEMO',
            'currency' => 'ZMW',
            'timezone' => 'Africa/Lusaka',
            'plan' => 'growth',
            'status' => 'active',
            'profile' => [
                'tradingName' => 'Chilimbitso Money Lending',
                'tagline' => 'Together, We Grow',
                'address' => 'Sinda District, Eastern Province, Zambia',
                'phones' => '+260 977 700 630 / +260 976 944 665',
                'receiptNote' => 'Thank you for your payment. Please keep this receipt for your records.',
            ],
        ]);

        // Second dummy tenant (for multi-tenancy demo)
        Tenant::create([
            'id' => Str::uuid()->toString(),
            'name' => 'Copperbelt Teachers SACCO',
            'code' => 'CBTSACCO',
            'plan' => 'starter',
            'status' => 'active',
            'profile' => [],
        ]);

        // --- Branches ---
        $snd = Branch::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Sinda Main', 'code' => 'SND', 'address' => 'Great East Road, Sinda']);
        $ktt = Branch::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Katete', 'code' => 'KTT', 'address' => 'Katete Central, Katete']);
        $ptk = Branch::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Petauke', 'code' => 'PTK', 'address' => 'Petauke Central, Petauke']);

        // --- Chart of accounts ---
        $this->seedChart($tenant->id);

        // --- Staff ---
        $platform = User::create(['id' => Str::uuid()->toString(), 'tenant_id' => null, 'email' => 'platform@chilimbitso.zm', 'password_hash' => $ph, 'full_name' => 'Platform Operator', 'role' => 'platform_admin', 'approval_limit' => 0]);
        $admin    = $this->makeUser($tenant->id, 'admin@demo.zm', $ph, 'Grace Mwansa', 'institution_admin');
        $officer  = $this->makeUser($tenant->id, 'officer@demo.zm', $ph, 'Joseph Banda', 'credit_officer', [$snd->id], '0', $tenant->id);
        $officer2 = $this->makeUser($tenant->id, 'officer.copperbelt@demo.zm', $ph, 'Ruth Chileshe', 'credit_officer', [$ktt->id, $ptk->id], '0', $tenant->id);
        $manager  = $this->makeUser($tenant->id, 'manager@demo.zm', $ph, 'Peter Mulenga', 'credit_manager', [], '150000', $tenant->id);
        $cashier  = $this->makeUser($tenant->id, 'cashier@demo.zm', $ph, 'Agnes Tembo', 'cashier', [$snd->id, $ktt->id, $ptk->id], '0', $tenant->id);
        $accountant = $this->makeUser($tenant->id, 'accountant@demo.zm', $ph, 'Mwila Phiri', 'accountant');
        $auditor  = $this->makeUser($tenant->id, 'auditor@demo.zm', $ph, 'Inonge Siame', 'auditor');

        // Assign Spatie roles
        $roleMap = [
            [$platform, 'platform_admin'], [$admin, 'institution_admin'],
            [$officer, 'credit_officer'],  [$officer2, 'credit_officer'],
            [$manager, 'credit_manager'],  [$cashier, 'cashier'],
            [$accountant, 'accountant'],   [$auditor, 'auditor'],
        ];
        foreach ($roleMap as [$user, $role]) {
            $user->assignRole($role);
        }

        // --- Loan products ---
        $sal = LoanProduct::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Salary Advance', 'code' => 'SAL', 'description' => 'Payroll-backed advances for formally employed customers: 22% for the whole loan', 'interest_method' => 'flat_term', 'annual_rate_pct' => 22, 'repayment_frequency' => 'monthly', 'min_amount' => 1000, 'max_amount' => 50000, 'min_term' => 1, 'max_term' => 6, 'processing_fee_pct' => 3, 'penalty_pct' => 5, 'grace_days' => 3, 'max_dti_pct' => 40]);
        $sme = LoanProduct::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'SME Working Capital', 'code' => 'SME', 'description' => 'Amortising loans for registered small businesses', 'interest_method' => 'reducing_balance', 'annual_rate_pct' => 36, 'repayment_frequency' => 'monthly', 'min_amount' => 5000, 'max_amount' => 250000, 'min_term' => 3, 'max_term' => 24, 'processing_fee_pct' => 2.5, 'penalty_pct' => 5, 'grace_days' => 5, 'max_dti_pct' => 45, 'requires_guarantor' => true, 'requires_collateral' => true]);
        $mkt = LoanProduct::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Marketeers Loan', 'code' => 'MKT', 'description' => 'Short-term daily-repayment loans for market traders', 'interest_method' => 'flat_term', 'annual_rate_pct' => 40, 'repayment_frequency' => 'daily', 'min_amount' => 500, 'max_amount' => 5000, 'min_term' => 20, 'max_term' => 28, 'processing_fee_pct' => 0, 'penalty_pct' => 2, 'grace_days' => 0, 'max_dti_pct' => 50]);
        $agr = LoanProduct::create(['id' => Str::uuid()->toString(), 'tenant_id' => $tenant->id, 'name' => 'Agri Input Bullet', 'code' => 'AGR', 'description' => 'Interest-only seasonal loans for smallholder farmers', 'interest_method' => 'interest_only', 'annual_rate_pct' => 30, 'repayment_frequency' => 'monthly', 'min_amount' => 2000, 'max_amount' => 80000, 'min_term' => 3, 'max_term' => 9, 'processing_fee_pct' => 2, 'penalty_pct' => 3, 'grace_days' => 14, 'max_dti_pct' => 45]);

        // --- Customers (36 total, 12 per branch) ---
        $branches = [$snd, $ktt, $ptk];
        $officers = [$officer->id, $officer2->id, $officer2->id];
        $customers = [];
        $nrcCounter = 100001;
        for ($i = 0; $i < 36; $i++) {
            $branchIdx = (int) floor($i / 12);
            $branch = $branches[$branchIdx];
            $income = round(4000 + $this->rand() * 26000, 2);
            $empIdx = (int) floor($this->rand() * count($this->employers));
            $employer = $this->employers[$empIdx];
            $occupation = $this->occupations[$empIdx];
            $dob = now()->subYears(25 + (int) floor($this->rand() * 30))->subDays((int) floor($this->rand() * 365))->format('Y-m-d');
            $custNum = 'CUS-' . str_pad($i + 1, 6, '0', STR_PAD_LEFT);
            $nrc = $nrcCounter++ . '/90/' . ((int) floor($this->rand() * 3) + 1);
            $kycStatus = $i >= 34 ? 'pending' : 'verified';
            $custId = Str::uuid()->toString();
            DB::table('customers')->insert([
                'id' => $custId,
                'tenant_id' => $tenant->id,
                'branch_id' => $branch->id,
                'customer_number' => $custNum,
                'first_name' => $this->pick($this->first),
                'last_name' => $this->pick($this->last),
                'nrc' => $nrc,
                'phone' => '0' . (97 + (int) floor($this->rand() * 3)) . (string) (int) floor($this->rand() * 9000000 + 1000000),
                'date_of_birth' => $dob,
                'gender' => $this->rand() > 0.5 ? 'female' : 'male',
                'address' => $branch->name . ' Area',
                'employer' => $employer,
                'occupation' => $occupation,
                'monthly_income' => $income,
                'kyc_status' => $kycStatus,
                'kyc_decided_by' => $kycStatus === 'verified' ? $manager->id : null,
                'consent_at' => now()->subDays((int) floor($this->rand() * 300 + 30)),
                'created_by' => $officers[$branchIdx],
                'created_at' => now()->subDays((int) floor($this->rand() * 300 + 30)),
            ]);

            // Create borrower user for first customer
            if ($i === 0) {
                $borrowerUser = $this->makeUser($tenant->id, 'borrower@demo.zm', $ph, 'Demo Borrower', 'borrower');
                DB::table('users')->where('id', $borrowerUser->id)->update(['customer_id' => $custId]);
                $borrowerUser->assignRole('borrower');
            }

            $customers[] = $custId;
        }

        DB::statement('SET session_replication_role = DEFAULT');

        // --- Loans, disbursements, payments ---
        [$appCount, $loanCount, $payCount] = $this->seedLoans(
            $tenant->id, $snd, $ktt, $ptk,
            $sal, $sme, $mkt, $agr,
            $officer, $officer2, $manager, $cashier,
            $customers
        );

        // Update counters so NumberingService picks up from correct sequence
        DB::table('counters')->insert([
            ['tenant_id' => $tenant->id, 'key' => 'customer',    'value' => 36],
            ['tenant_id' => $tenant->id, 'key' => 'application',  'value' => $appCount],
            ['tenant_id' => $tenant->id, 'key' => 'loan',         'value' => $loanCount],
            ['tenant_id' => $tenant->id, 'key' => 'payment',      'value' => $payCount],
        ]);

        $this->command?->info("Demo seeded: tenant={$tenant->code}, 36 customers, {$appCount} applications, {$loanCount} loans, {$payCount} payments");
    }

    private function makeUser(string $tenantId, string $email, string $ph, string $fullName, string $role, array $branchIds = [], string $limit = '0'): User
    {
        $user = User::create([
            'id' => Str::uuid()->toString(),
            'tenant_id' => $tenantId,
            'email' => $email,
            'password_hash' => $ph,
            'full_name' => $fullName,
            'role' => $role,
            'approval_limit' => $limit,
        ]);
        foreach ($branchIds as $bid) {
            UserBranchAccess::create(['user_id' => $user->id, 'branch_id' => $bid, 'tenant_id' => $tenantId]);
        }
        return $user;
    }

    /**
     * Seed 12 applications → 8 active loans → disbursements → payments.
     * Returns [$appCount, $loanCount, $payCount].
     */
    private function seedLoans(
        string $tenantId,
        Branch $snd, Branch $ktt, Branch $ptk,
        LoanProduct $sal, LoanProduct $sme, LoanProduct $mkt, LoanProduct $agr,
        User $officer, User $officer2, User $manager, User $cashier,
        array $customers
    ): array {
        // Loan plan: [product, branch, officer, custIdx, amount, term, disbursedMonthsAgo, paidInstallments]
        // paidInstallments=null means loan is submitted/rejected only
        $plans = [
            // SAL — 3 active, 1 rejected
            [$sal, $snd, $officer,  0,  15000, 4, 5, 4],  // 4 of 4 paid → closed? no, 4 of 4 → active with final due
            [$sal, $snd, $officer,  1,  8500,  3, 3, 2],  // 2 of 3 paid
            [$sal, $ktt, $officer2, 12, 25000, 6, 4, 3],  // 3 of 6 paid
            [$sal, $ktt, $officer2, 13, 5000,  2, 0, null], // rejected
            // SME — 2 active, 1 submitted
            [$sme, $snd, $officer,  2,  75000, 12, 5, 4], // 4 of 12 paid
            [$sme, $ptk, $officer2, 24, 50000,  6, 3, 2], // 2 of 6 paid
            [$sme, $ptk, $officer2, 25, 30000,  6, 0, null], // submitted
            // MKT — 2 active
            [$mkt, $snd, $officer,  3, 3000, 20, 1, 15], // 15 of 20 paid (daily)
            [$mkt, $ktt, $officer2, 14, 2000, 28, 2, 28], // 28 of 28 paid → close it
            // AGR — 1 active, 1 submitted
            [$agr, $ptk, $officer2, 26, 40000, 6, 4, 3],  // 3 of 6 paid
            [$agr, $snd, $officer,  4,  20000, 4, 0, null], // submitted
        ];

        $appCount  = 0;
        $loanCount = 0;
        $payCount  = 0;

        foreach ($plans as $plan) {
            [$product, $branch, $offUser, $custIdx, $amount, $term, $monthsAgo, $paidCount] = $plan;
            $custId = $customers[$custIdx];

            $appCount++;
            $appNum    = 'APP-' . str_pad($appCount, 6, '0', STR_PAD_LEFT);
            $appId     = Str::uuid()->toString();
            $submittedAt = now()->subMonths($monthsAgo + 1)->subDays((int)($this->rand() * 14 + 5));
            $status    = $paidCount === null ? (($appCount % 7 === 4) ? 'rejected' : 'submitted') : 'approved';

            DB::table('loan_applications')->insert([
                'id'                      => $appId,
                'tenant_id'               => $tenantId,
                'branch_id'               => $branch->id,
                'application_number'      => $appNum,
                'customer_id'             => $custId,
                'product_id'              => $product->id,
                'amount'                  => $amount,
                'term'                    => $term,
                'purpose'                 => 'Business / household expense',
                'monthly_income'          => round(8000 + $this->rand() * 20000, 2),
                'monthly_expenses'        => round(3000 + $this->rand() * 5000, 2),
                'existing_debt_repayments' => 0,
                'status'                  => $status,
                'channel'                 => 'branch',
                'assessment'              => '{}',
                'submitted_by'            => $offUser->id,
                'submitted_at'            => $submittedAt,
                'decided_at'              => $status !== 'submitted' ? $submittedAt->copy()->addDays(2) : null,
            ]);

            if ($status !== 'approved') continue;

            // --- Loan ---
            $loanCount++;
            $loanNum   = 'LN-' . str_pad($loanCount, 6, '0', STR_PAD_LEFT);
            $loanId    = Str::uuid()->toString();
            $disbDate  = now()->subMonths($monthsAgo)->startOfMonth()->toDateString();

            $schedule = ScheduleService::generate([
                'principal'        => (string) $amount,
                'annualRatePct'    => (string) $product->annual_rate_pct,
                'interestMethod'   => $product->interest_method,
                'frequency'        => $product->repayment_frequency,
                'term'             => $term,
                'startDate'        => $disbDate,
                'processingFeePct' => (string) $product->processing_fee_pct,
            ]);

            $fee       = $schedule['processingFee'];
            $netAmount = $schedule['netDisbursed'];

            $allPaid   = ($paidCount !== null && $paidCount >= $term);
            $loanStatus = $allPaid ? 'closed' : 'active';

            DB::table('loans')->insert([
                'id'              => $loanId,
                'tenant_id'       => $tenantId,
                'branch_id'       => $branch->id,
                'loan_number'     => $loanNum,
                'application_id'  => $appId,
                'customer_id'     => $custId,
                'product_id'      => $product->id,
                'officer_id'      => $offUser->id,
                'approved_by'     => $manager->id,
                'principal'       => $amount,
                'annual_rate_pct' => $product->annual_rate_pct,
                'interest_method' => $product->interest_method,
                'frequency'       => $product->repayment_frequency,
                'term'            => $term,
                'processing_fee'  => $fee,
                'penalty_pct'     => $product->penalty_pct,
                'grace_days'      => $product->grace_days,
                'status'          => $loanStatus,
                'disbursed_on'    => $disbDate,
                'maturity_date'   => $schedule['installments'][$term - 1]['dueDate'],
                'closed_at'       => $allPaid ? now()->subDays(5) : null,
                'created_at'      => $disbDate,
            ]);

            // --- Schedule items ---
            foreach ($schedule['installments'] as $inst) {
                $isPaid = ($paidCount !== null && $inst['no'] <= $paidCount);
                DB::table('loan_schedule_items')->insert([
                    'id'            => Str::uuid()->toString(),
                    'tenant_id'     => $tenantId,
                    'loan_id'       => $loanId,
                    'installment_no' => $inst['no'],
                    'due_date'      => $inst['dueDate'],
                    'principal_due' => $inst['principal'],
                    'interest_due'  => $inst['interest'],
                    'fee_due'       => '0.00',
                    'penalty_due'   => '0.00',
                    'principal_paid' => $isPaid ? $inst['principal'] : '0.00',
                    'interest_paid'  => $isPaid ? $inst['interest'] : '0.00',
                    'fee_paid'       => '0.00',
                    'penalty_paid'   => '0.00',
                ]);
            }

            // --- Disbursement ---
            DB::table('loan_disbursements')->insert([
                'id'           => Str::uuid()->toString(),
                'tenant_id'    => $tenantId,
                'loan_id'      => $loanId,
                'amount'       => $amount,
                'fee'          => $fee,
                'net_amount'   => $netAmount,
                'channel'      => 'bank',
                'destination'  => 'ZNBS Account',
                'value_date'   => $disbDate,
                'status'       => 'completed',
                'requested_by' => $offUser->id,
                'requested_at' => $disbDate,
                'decided_by'   => $manager->id,
                'decided_at'   => $disbDate,
            ]);

            // --- Payments ---
            if ($paidCount === null || $paidCount === 0) continue;

            $installmentsToPay = array_slice($schedule['installments'], 0, $paidCount);
            foreach ($installmentsToPay as $inst) {
                $payCount++;
                $receiptNum = 'PAY-' . str_pad($payCount, 6, '0', STR_PAD_LEFT);
                $payId      = Str::uuid()->toString();
                $receivedOn = Carbon::parse($inst['dueDate'])->subDays((int)($this->rand() * 3))->toDateString();

                DB::table('payments')->insert([
                    'id'              => $payId,
                    'tenant_id'       => $tenantId,
                    'loan_id'         => $loanId,
                    'receipt_number'  => $receiptNum,
                    'amount'          => $inst['total'],
                    'unallocated'     => '0.00',
                    'channel'         => 'cash',
                    'idempotency_key' => Str::uuid()->toString(),
                    'status'          => 'posted',
                    'received_on'     => $receivedOn,
                    'recorded_by'     => $cashier->id,
                    'created_at'      => $receivedOn,
                ]);

                // Payment allocations (interest first, then principal)
                $schedItem = DB::table('loan_schedule_items')
                    ->where('loan_id', $loanId)
                    ->where('installment_no', $inst['no'])
                    ->first();

                if ($schedItem && bccomp($inst['interest'], '0', 2) > 0) {
                    DB::table('payment_allocations')->insert([
                        'id'               => Str::uuid()->toString(),
                        'tenant_id'        => $tenantId,
                        'payment_id'       => $payId,
                        'schedule_item_id' => $schedItem->id,
                        'component'        => 'interest',
                        'amount'           => $inst['interest'],
                    ]);
                }
                if ($schedItem && bccomp($inst['principal'], '0', 2) > 0) {
                    DB::table('payment_allocations')->insert([
                        'id'               => Str::uuid()->toString(),
                        'tenant_id'        => $tenantId,
                        'payment_id'       => $payId,
                        'schedule_item_id' => $schedItem->id,
                        'component'        => 'principal',
                        'amount'           => $inst['principal'],
                    ]);
                }
            }
        }

        return [$appCount, $loanCount, $payCount];
    }

    private function seedChart(string $tenantId): void
    {
        $accounts = [
            ['1001', 'Cash on Hand',          'asset'],
            ['1002', 'Bank Account',           'asset'],
            ['1003', 'MTN Mobile Money',       'asset'],
            ['1004', 'Airtel Money',           'asset'],
            ['1100', 'Loans Receivable',       'asset'],
            ['2001', 'Customer Credits',       'liability'],
            ['3001', 'Capital Fund',           'equity'],
            ['4001', 'Interest Income',        'income'],
            ['4002', 'Processing Fee Income',  'income'],
            ['4003', 'Penalty Income',         'income'],
            ['5001', 'Loan Loss Expense',      'expense'],
        ];
        foreach ($accounts as [$code, $name, $type]) {
            DB::table('chart_of_accounts')->insert([
                'id' => Str::uuid()->toString(),
                'tenant_id' => $tenantId,
                'code' => $code,
                'name' => $name,
                'type' => $type,
            ]);
        }
    }
}
