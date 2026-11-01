@php
    $loan = $getRecord()->loadMissing(['customer', 'product', 'branch', 'officer', 'schedule', 'payments']);
    $today = now()->startOfDay();
    $items = $loan->schedule;
    $owing = fn ($i) => max(0, (float) $i->total_due - (float) $i->total_paid);

    $totalDue = $items->sum(fn ($i) => (float) $i->total_due);
    $totalPaid = $items->sum(fn ($i) => (float) $i->total_paid);
    $principalLeft = $items->sum(fn ($i) => max(0, (float) $i->principal_due - (float) $i->principal_paid));
    $late = $items->filter(fn ($i) => $i->due_date->lt($today) && $owing($i) > 0);
    $arrears = $late->sum($owing);
    $daysLate = $late->isNotEmpty() ? (int) $late->first()->due_date->diffInDays($today) : 0;
    $next = $items->first(fn ($i) => $owing($i) > 0 && $i->due_date->gte($today));
    $pct = $totalDue > 0 ? min(100, (int) round($totalPaid / $totalDue * 100)) : 0;
    $settled = $items->filter(fn ($i) => $owing($i) <= 0)->count();

    $k = fn ($v) => 'K ' . number_format((float) $v, 2);
    $label = fn ($s) => ucfirst(str_replace('_', ' ', $s));
    $tone = match ($loan->status) {
        'active' => $arrears > 0 ? 'danger' : 'success',
        'pending_disbursement' => 'warning',
        'written_off' => 'danger',
        default => 'gray',
    };
@endphp

<div class="ch-loan">
    <div class="ch-loan-head">
        <div>
            <p class="ch-loan-eyebrow">{{ $loan->product?->name }} · {{ $loan->branch?->name }}</p>
            <h2 class="ch-loan-name">{{ $loan->customer?->full_name }}</h2>
            <p class="ch-loan-meta">
                {{ $loan->term }} {{ ['daily' => 'days', 'weekly' => 'weeks', 'fortnightly' => 'fortnights', 'monthly' => 'months'][$loan->frequency] ?? 'periods' }}
                · {{ rtrim(rtrim(number_format((float) $loan->annual_rate_pct, 2), '0'), '.') }}% a year, {{ str_replace('_', ' ', $loan->interest_method) }}
                @if ($loan->officer) · Officer {{ $loan->officer->full_name }} @endif
            </p>
        </div>
        <span class="ch-pill ch-pill-{{ $tone }}">
            {{ $loan->status === 'active' && $arrears > 0 ? "In arrears · {$daysLate} days" : $label($loan->status) }}
        </span>
    </div>

    <div class="ch-loan-tiles">
        <div class="ch-tile"><span>Principal</span><strong>{{ $k($loan->principal) }}</strong><small>Disbursed {{ $loan->disbursed_on?->format('j M Y') ?? 'not yet' }}</small></div>
        <div class="ch-tile"><span>Repaid</span><strong>{{ $k($totalPaid) }}</strong><small>{{ $settled }} of {{ $items->count() }} instalments settled</small></div>
        <div class="ch-tile"><span>Principal left</span><strong>{{ $k($principalLeft) }}</strong><small>Matures {{ $loan->maturity_date?->format('j M Y') ?? '—' }}</small></div>
        <div class="ch-tile {{ $arrears > 0 ? 'ch-tile-alert' : '' }}"><span>Arrears</span><strong>{{ $k($arrears) }}</strong><small>{{ $arrears > 0 ? $late->count() . ' instalment' . ($late->count() === 1 ? '' : 's') . ' late' : 'Nothing overdue' }}</small></div>
    </div>

    @if ($items->isNotEmpty())
        <div class="ch-progress">
            <div class="ch-progress-row">
                <span>{{ $pct }}% of {{ $k($totalDue) }} repaid</span>
                @if ($next)
                    <span>Next: <strong>{{ $k($owing($next)) }}</strong> on {{ $next->due_date->format('j M Y') }}</span>
                @endif
            </div>
            <div class="ch-progress-track" role="progressbar" aria-valuenow="{{ $pct }}" aria-valuemin="0" aria-valuemax="100" aria-label="Share of the loan repaid">
                <div class="ch-progress-fill" style="width: {{ $pct }}%"></div>
            </div>
        </div>
    @endif

    <section class="ch-panel">
        <h3>Repayment schedule</h3>
        @if ($items->isEmpty())
            <p class="ch-empty">The schedule is created when the loan is disbursed.</p>
        @else
            <div class="ch-table-wrap">
                <table class="ch-table">
                    <thead><tr><th>#</th><th>Due</th><th class="num">Principal</th><th class="num">Interest</th><th class="num">Fees and penalty</th><th class="num">Paid</th><th class="num">Owing</th><th>Status</th></tr></thead>
                    <tbody>
                    @foreach ($items as $i)
                        @php
                            $left = $owing($i);
                            [$state, $stateTone] = match (true) {
                                $left <= 0 => ['Paid', 'success'],
                                $i->due_date->lt($today) => ['Overdue', 'danger'],
                                (float) $i->total_paid > 0 => ['Part paid', 'warning'],
                                default => ['Upcoming', 'gray'],
                            };
                        @endphp
                        <tr @class(['is-next' => $next && $next->is($i), 'is-late' => $stateTone === 'danger'])>
                            <td>{{ $i->installment_no }}</td>
                            <td>{{ $i->due_date->format('j M Y') }}</td>
                            <td class="num">{{ number_format((float) $i->principal_due, 2) }}</td>
                            <td class="num">{{ number_format((float) $i->interest_due, 2) }}</td>
                            <td class="num">{{ number_format((float) $i->fee_due + (float) $i->penalty_due, 2) }}</td>
                            <td class="num">{{ number_format((float) $i->total_paid, 2) }}</td>
                            <td class="num"><strong>{{ number_format($left, 2) }}</strong></td>
                            <td><span class="ch-pill ch-pill-{{ $stateTone }}">{{ $state }}</span></td>
                        </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>

    <section class="ch-panel">
        <h3>Payments received</h3>
        @if ($loan->payments->isEmpty())
            <p class="ch-empty">No payments yet.</p>
        @else
            <div class="ch-table-wrap">
                <table class="ch-table">
                    <thead><tr><th>Receipt</th><th>Date</th><th>Channel</th><th class="num">Amount</th><th>Status</th></tr></thead>
                    <tbody>
                    @foreach ($loan->payments as $p)
                        <tr>
                            <td class="mono">{{ $p->receipt_number }}</td>
                            <td>{{ $p->received_on->format('j M Y') }}</td>
                            <td>{{ match ($p->channel) { 'mtn_momo' => 'MTN MoMo', 'airtel_money' => 'Airtel Money', default => ucfirst($p->channel) } }}</td>
                            <td class="num">{{ $k($p->amount) }}</td>
                            <td><span class="ch-pill ch-pill-{{ $p->status === 'posted' ? 'success' : 'gray' }}">{{ $label($p->status) }}</span></td>
                        </tr>
                    @endforeach
                    </tbody>
                </table>
            </div>
        @endif
    </section>
</div>
