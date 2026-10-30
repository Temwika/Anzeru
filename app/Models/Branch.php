<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['created_at' => 'datetime'];
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function users() { return $this->hasManyThrough(User::class, UserBranchAccess::class, 'branch_id', 'id', 'id', 'user_id'); }
    public function customers() { return $this->hasMany(Customer::class); }
    public function loans() { return $this->hasMany(Loan::class); }
}
