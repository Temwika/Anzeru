<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Http\Request;

class ReceiptController extends Controller
{
    public function show(string $id)
    {
        $payment = Payment::with([
            'loan.customer',
            'loan.product',
            'loan.tenant',
            'allocations',
            'recorder',
        ])->findOrFail($id);

        // Ensure the authenticated user belongs to the same tenant
        $tenant = $payment->loan->tenant;

        return view('receipts.show', compact('payment', 'tenant'));
    }
}
