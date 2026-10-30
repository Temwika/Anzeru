<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = ['name', 'code', 'currency', 'timezone', 'plan', 'status', 'profile'];
    protected $casts = ['profile' => 'array', 'created_at' => 'datetime'];

    public function branches() { return $this->hasMany(Branch::class); }
    public function users() { return $this->hasMany(User::class); }
    public function loanProducts() { return $this->hasMany(LoanProduct::class); }
    public function chartOfAccounts() { return $this->hasMany(ChartOfAccount::class); }
}
