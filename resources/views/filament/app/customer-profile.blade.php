@php
    use App\Filament\App\Resources\LoanApplicationResource;
    use App\Filament\App\Resources\LoanResource;

    $c = $getRecord()->loadMissing(['branch', 'group', 'loans.product', 'loans.schedule', 'applications.product']);
    $today = now()->startOfDay();
    $k = fn ($v) => 'K ' . number_format((float) $v, 2);
    $label = fn ($s) => ucfirst(str_replace('_', ' ', $s));

    // One pass over every loan's schedule gives the money figures and each row's progress.
    $loans = $c->loans->sortByDesc('created_at')->map(function ($loan) use ($today) {
        $s = $loan->schedule;
        $due = $s->sum(fn ($i) => (float) $i->total_due);
        $paid = $s->sum(fn ($i) => (float) $i->total_paid);
        $loan->ch_paid = $paid;
        $loan->ch_pct = $due > 0 ? min(100, (int) round($paid / $due * 100)) : 0;
        $loan->ch_left = $s->sum(fn ($i) => max(0, (float) $i->principal_due - (float) $i->principal_paid));
        $loan->ch_arrears = $s->filter(fn ($i) => $i->due_date->lt($today))
            ->sum(fn ($i) => max(0, (float) $i->total_due - (float) $i->total_paid));
        return $loan;
    });
    $active = $loans->where('status', 'active');
    $outstanding = $active->sum('ch_left');
    $arrears = $active->sum('ch_arrears');
    $repaid = $loans->sum('ch_paid');
    $initials = strtoupper(mb_substr($c->first_name, 0, 1) . mb_substr($c->last_name, 0, 1));
    $kycTone = ['verified' => 'success', 'pending' => 'warning', 'rejected' => 'danger'][$c->kyc_status] ?? 'gray';

    $details = array_filter([
        'NRC' => $c->nrc,
        'Phone' => $c->phone,
        'Email' => $c->email,
        'Date of birth' => $c->date_of_birth ? $c->date_of_birth->format('j M Y') . ' (' . $c->date_of_birth->age . ')' : null,
        'Gender' => $c->gender ? ucfirst($c->gender) : null,
        'Address' => $c->address,
        'Work' => trim(implode(' at ', array_filter([$c->occupation, $c->employer]))) ?: null,
        'Group' => $c->group?->name,
        'Next of kin' => trim(implode(' · ', array_filter([$c->next_of_kin_name, $c->next_of_kin_phone]))) ?: null,
        'Customer since' => $c->created_at?->format('j M Y'),
    ]);
@endphp

<div class="ch-loan">
    <div class="ch-loan-head">
        <div class="ch-person">
            <span class="ch-avatar" aria-hidden="true">{{ $initials }}</span>
            <div>
                <p class="ch-loan-eyebrow">{{ $c->customer_number }} · {{ $c->branch?->name }}</p>
                <h2 class="ch-loan-name">{{ $c->full_name }}</h2>
                <p class="ch-loan-meta">{{ $c->phone }}@if ($c->occupation) · {{ $c->occupation }}@endif</p>
            </div>
        </div>
        <span class="ch-pill ch-pill-{{ $kycTone }}">KYC {{ strtolower($label($c->kyc_status)) }}</span>
    </div>

    @if ($c->kyc_status !== 'verified' && $c->kyc_note)
        <p class="ch-note ch-note-{{ $kycTone }}">{{ $c->kyc_note }}</p>
    @endif

    <div class="ch-loan-tiles">
        <div class="ch-tile"><span>Owes in principal</span><strong>{{ $k($outstanding) }}</strong><small>{{ $active->count() }} active loan{{ $active->count() === 1 ? '' : 's' }}</small></div>
        <div class="ch-tile"><span>Repaid to date</span><strong>{{ $k($repaid) }}</strong><small>Across {{ $loans->count() }} loan{{ $loans->count() === 1 ? '' : 's' }}</small></div>
        <div class="ch-tile {{ $arrears > 0 ? 'ch-tile-alert' : '' }}"><span>Arrears</span><strong>{{ $k($arrears) }}</strong><small>{{ $arrears > 0 ? 'Needs follow-up' : 'Nothing overdue' }}</small></div>
        <div class="ch-tile"><span>Monthly income</span><strong>{{ $k($c->monthly_income) }}</strong><small>As declared</small></div>
    </div>

    <div class="ch-split">
        <section class="ch-panel">
            <h3>Loans</h3>
            @if ($loans->isEmpty())
                <p class="ch-empty">No loans yet.</p>
            @else
                <ul class="ch-list">
                    @foreach ($loans as $loan)
                        @php
                            $tone = match ($loan->status) {
                                'active' => $loan->ch_arrears > 0 ? 'danger' : 'success',
                                'pending_disbursement' => 'warning',
                                'written_off' => 'danger',
                                default => 'gray',
                            };
                        @endphp
                        <li>
                            <a class="ch-list-item" href="{{ LoanResource::getUrl('view', ['record' => $loan]) }}">
                                <div class="ch-list-main">
                                    <span class="ch-list-title">{{ $loan->loan_number }} <em>{{ $loan->product?->name }}</em></span>
                                    <span class="ch-list-sub">{{ $k($loan->principal) }} lent{{ $loan->disbursed_on ? ' on ' . $loan->disbursed_on->format('j M Y') : '' }}</span>
                                    @if ($loan->schedule->isNotEmpty())
                                        <span class="ch-mini-track" title="{{ $loan->ch_pct }}% repaid"><span style="width: {{ $loan->ch_pct }}%"></span></span>
                                    @endif
                                </div>
                                <span class="ch-pill ch-pill-{{ $tone }}">{{ $loan->status === 'active' && $loan->ch_arrears > 0 ? 'In arrears' : $label($loan->status) }}</span>
                            </a>
                        </li>
                    @endforeach
                </ul>
            @endif

            <h3 class="ch-panel-sub">Applications</h3>
            @if ($c->applications->isEmpty())
                <p class="ch-empty">No applications yet.</p>
            @else
                <ul class="ch-list">
                    @foreach ($c->applications->sortByDesc('submitted_at') as $app)
                        <li>
                            <a class="ch-list-item" href="{{ LoanApplicationResource::getUrl('view', ['record' => $app]) }}">
                                <div class="ch-list-main">
                                    <span class="ch-list-title">{{ $app->application_number }} <em>{{ $app->product?->name }}</em></span>
                                    <span class="ch-list-sub">{{ $k($app->amount) }}{{ $app->submitted_at ? ' · ' . $app->submitted_at->format('j M Y') : '' }}</span>
                                </div>
                                <span class="ch-pill ch-pill-{{ ['approved' => 'success', 'submitted' => 'warning', 'rejected' => 'danger'][$app->status] ?? 'gray' }}">{{ $label($app->status) }}</span>
                            </a>
                        </li>
                    @endforeach
                </ul>
            @endif
        </section>

        <section class="ch-panel">
            <h3>Details</h3>
            <dl class="ch-dl">
                @foreach ($details as $term => $value)
                    <div><dt>{{ $term }}</dt><dd>{{ $value }}</dd></div>
                @endforeach
            </dl>
        </section>
    </div>
</div>
