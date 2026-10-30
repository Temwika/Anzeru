<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class LoanDisbursement extends Model
{
    use BelongsToTenant;

    protected $table = 'loan_disbursements';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'amount' => 'decimal:2',
        'fee' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'value_date' => 'date',
        'requested_at' => 'datetime',
        'decided_at' => 'datetime',
    ];
    protected $guarded = [];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function requester() { return $this->belongsTo(User::class, 'requested_by'); }
    public function decider() { return $this->belongsTo(User::class, 'decided_by'); }
}
