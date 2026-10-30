<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'date_of_birth' => 'date',
        'monthly_income' => 'decimal:2',
        'consent_at' => 'datetime',
        'created_at' => 'datetime',
    ];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function group() { return $this->belongsTo(LoanGroup::class, 'group_id'); }
    public function documents() { return $this->hasMany(CustomerDocument::class); }
    public function applications() { return $this->hasMany(LoanApplication::class); }
    public function loans() { return $this->hasMany(Loan::class); }

    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}
