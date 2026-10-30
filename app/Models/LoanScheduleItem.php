<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class LoanScheduleItem extends Model
{
    use BelongsToTenant;

    protected $table = 'loan_schedule_items';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'due_date' => 'date',
        'principal_due' => 'decimal:2',
        'interest_due' => 'decimal:2',
        'fee_due' => 'decimal:2',
        'penalty_due' => 'decimal:2',
        'principal_paid' => 'decimal:2',
        'interest_paid' => 'decimal:2',
        'fee_paid' => 'decimal:2',
        'penalty_paid' => 'decimal:2',
        'penalty_applied_at' => 'datetime',
    ];
    protected $guarded = [];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function allocations() { return $this->hasMany(PaymentAllocation::class, 'schedule_item_id'); }

    public function getTotalDueAttribute(): string
    {
        return bcadd(bcadd(bcadd($this->principal_due, $this->interest_due, 2), $this->fee_due, 2), $this->penalty_due, 2);
    }

    public function getTotalPaidAttribute(): string
    {
        return bcadd(bcadd(bcadd($this->principal_paid, $this->interest_paid, 2), $this->fee_paid, 2), $this->penalty_paid, 2);
    }
}
