<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CreditDecision extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['approver_limit' => 'decimal:2', 'decided_at' => 'datetime'];
    protected $guarded = [];

    public function application() { return $this->belongsTo(LoanApplication::class, 'application_id'); }
    public function decider() { return $this->belongsTo(User::class, 'decided_by'); }
}
