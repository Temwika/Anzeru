<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'amount' => 'decimal:2',
        'unallocated' => 'decimal:2',
        'received_on' => 'date',
        'interest_waivers' => 'array',
        'created_at' => 'datetime',
    ];
    protected $guarded = [];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function allocations() { return $this->hasMany(PaymentAllocation::class); }
    public function reversal() { return $this->hasOne(PaymentReversal::class); }
    public function recorder() { return $this->belongsTo(User::class, 'recorded_by'); }
}
