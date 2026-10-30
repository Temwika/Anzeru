<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Collateral extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['estimated_value' => 'decimal:2', 'created_at' => 'datetime'];
    protected $guarded = [];

    public function application() { return $this->belongsTo(LoanApplication::class, 'application_id'); }
    public function documents() { return $this->hasMany(ApplicationDocument::class, 'collateral_id'); }
}
