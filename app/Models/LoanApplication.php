<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class LoanApplication extends Model
{
    use BelongsToTenant;

    protected $table = 'loan_applications';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'amount' => 'decimal:2',
        'monthly_income' => 'decimal:2',
        'monthly_expenses' => 'decimal:2',
        'existing_debt_repayments' => 'decimal:2',
        'assessment' => 'array',
        'submitted_at' => 'datetime',
        'decided_at' => 'datetime',
        'borrower_signed_at' => 'datetime',
    ];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function product() { return $this->belongsTo(LoanProduct::class, 'product_id'); }
    public function guarantors() { return $this->hasMany(Guarantor::class, 'application_id'); }
    public function collaterals() { return $this->hasMany(Collateral::class, 'application_id'); }
    public function documents() { return $this->hasMany(ApplicationDocument::class, 'application_id'); }
    public function decisions() { return $this->hasMany(CreditDecision::class, 'application_id'); }
    public function loan() { return $this->hasOne(Loan::class, 'application_id'); }
    public function submittedBy() { return $this->belongsTo(User::class, 'submitted_by'); }
}
