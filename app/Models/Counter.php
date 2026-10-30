<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Counter extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    public $timestamps = false;
    protected $primaryKey = null;
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
}
