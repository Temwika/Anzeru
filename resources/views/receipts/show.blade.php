<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt {{ $payment->receipt_number }}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; background: #fff; color: #000; }
  .page { width: 80mm; margin: 0 auto; padding: 4mm; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 3mm 0; }
  .row { display: flex; justify-content: space-between; margin: 1mm 0; }
  .row .label { color: #555; }
  .total { font-size: 14px; font-weight: bold; margin: 2mm 0; }
  .footer { font-size: 10px; color: #555; margin-top: 4mm; }
  @media print {
    body { background: #fff; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="center bold" style="font-size:14px;">{{ $tenant->name }}</div>
  <div class="center" style="font-size:10px;">{{ $tenant->profile['address'] ?? '' }}</div>
  <div class="center" style="font-size:10px;">{{ $tenant->profile['phones'] ?? '' }}</div>

  <div class="divider"></div>
  <div class="center bold">PAYMENT RECEIPT</div>
  <div class="divider"></div>

  <div class="row">
    <span class="label">Receipt #</span>
    <span class="bold">{{ $payment->receipt_number }}</span>
  </div>
  <div class="row">
    <span class="label">Date</span>
    <span>{{ \Carbon\Carbon::parse($payment->received_on)->format('d M Y') }}</span>
  </div>
  <div class="row">
    <span class="label">Recorded</span>
    <span>{{ $payment->recorder?->full_name ?? 'System' }}</span>
  </div>

  <div class="divider"></div>

  <div class="row">
    <span class="label">Borrower</span>
    <span>{{ $payment->loan->customer->full_name ?? '—' }}</span>
  </div>
  <div class="row">
    <span class="label">Loan #</span>
    <span>{{ $payment->loan->loan_number }}</span>
  </div>
  <div class="row">
    <span class="label">Product</span>
    <span>{{ $payment->loan->product->name ?? '—' }}</span>
  </div>

  <div class="divider"></div>

  @foreach ($payment->allocations as $alloc)
  <div class="row">
    <span class="label">{{ ucfirst($alloc->component) }}</span>
    <span>{{ number_format($alloc->amount, 2) }}</span>
  </div>
  @endforeach

  <div class="divider"></div>

  <div class="row total">
    <span>TOTAL PAID</span>
    <span>{{ strtoupper($payment->loan->tenant->currency ?? 'ZMW') }} {{ number_format($payment->amount, 2) }}</span>
  </div>

  <div class="row">
    <span class="label">Channel</span>
    <span>{{ strtoupper(str_replace('_', ' ', $payment->channel)) }}</span>
  </div>
  @if ($payment->external_ref)
  <div class="row">
    <span class="label">Ref</span>
    <span>{{ $payment->external_ref }}</span>
  </div>
  @endif

  <div class="divider"></div>

  <div class="footer center">
    {{ $tenant->profile['receiptNote'] ?? 'Thank you for your payment.' }}
  </div>
  <div class="footer center" style="margin-top:3mm;">
    Printed: {{ now()->format('d M Y H:i') }}
  </div>

  <div class="no-print center" style="margin-top:6mm;">
    <button onclick="window.print()" style="padding:4px 12px;cursor:pointer;">Print</button>
  </div>
</div>
</body>
</html>
