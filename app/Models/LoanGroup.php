<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class LoanGroup extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['is_active' => 'boolean', 'created_at' => 'datetime'];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
    public function officer() { return $this->belongsTo(User::class, 'officer_id'); }
    public function members() { return $this->hasMany(Customer::class, 'group_id'); }
}
