<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ApplicationDocument extends Model
{
    use BelongsToTenant;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['created_at' => 'datetime'];
    protected $guarded = [];

    public function application() { return $this->belongsTo(LoanApplication::class, 'application_id'); }
}
