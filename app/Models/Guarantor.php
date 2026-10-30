<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class Guarantor extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['signed_at' => 'datetime'];
    protected $guarded = [];

    public function application() { return $this->belongsTo(LoanApplication::class, 'application_id'); }
    public function documents() { return $this->hasMany(ApplicationDocument::class, 'guarantor_id'); }
}
