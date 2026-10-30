<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class LoanProduct extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'min_amount' => 'decimal:2',
        'max_amount' => 'decimal:2',
        'min_term' => 'integer',
        'max_term' => 'integer',
        'grace_days' => 'integer',
        'requires_guarantor' => 'boolean',
        'requires_collateral' => 'boolean',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
    ];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function applications() { return $this->hasMany(LoanApplication::class, 'product_id'); }
    public function loans() { return $this->hasMany(Loan::class, 'product_id'); }

    public function getTermLabelAttribute(): string
    {
        return $this->min_term === $this->max_term
            ? "{$this->min_term}"
            : "{$this->min_term}–{$this->max_term}";
    }
}
