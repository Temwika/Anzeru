<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CollectionRequest extends Model
{
    use BelongsToTenant;

    protected $table = 'collection_requests';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'amount' => 'decimal:2',
        'settlement' => 'boolean',
        'created_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
    protected $guarded = [];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function payment() { return $this->belongsTo(Payment::class); }
}
