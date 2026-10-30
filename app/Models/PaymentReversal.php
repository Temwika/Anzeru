<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PaymentReversal extends Model
{
    use BelongsToTenant;

    protected $table = 'payment_reversals';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['requested_at' => 'datetime', 'decided_at' => 'datetime'];
    protected $guarded = [];

    public function payment() { return $this->belongsTo(Payment::class); }
    public function requester() { return $this->belongsTo(User::class, 'requested_by'); }
    public function decider() { return $this->belongsTo(User::class, 'decided_by'); }
}
