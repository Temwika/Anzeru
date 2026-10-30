<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Loan extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'principal' => 'decimal:2',
        'processing_fee' => 'decimal:2',
        'disbursed_on' => 'date',
        'maturity_date' => 'date',
        'closed_at' => 'datetime',
        'created_at' => 'datetime',
    ];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function application() { return $this->belongsTo(LoanApplication::class, 'application_id'); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function product() { return $this->belongsTo(LoanProduct::class, 'product_id'); }
    public function officer() { return $this->belongsTo(User::class, 'officer_id'); }
    public function schedule() { return $this->hasMany(LoanScheduleItem::class)->orderBy('installment_no'); }
    public function disbursements() { return $this->hasMany(LoanDisbursement::class); }
    public function payments() { return $this->hasMany(Payment::class)->orderBy('received_on'); }
    public function activities() { return $this->hasMany(CollectionActivity::class)->latest('created_at'); }
    public function collectionRequests() { return $this->hasMany(CollectionRequest::class); }

    public function scopeActive($q) { return $q->where('status', 'active'); }
    public function scopePendingDisbursement($q) { return $q->where('status', 'pending_disbursement'); }
}
