<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class PaymentAllocation extends Model
{
    use BelongsToTenant;

    protected $table = 'payment_allocations';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['amount' => 'decimal:2'];
    protected $guarded = [];

    public function payment() { return $this->belongsTo(Payment::class); }
    public function scheduleItem() { return $this->belongsTo(LoanScheduleItem::class, 'schedule_item_id'); }
}
