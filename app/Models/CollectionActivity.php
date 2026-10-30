<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class CollectionActivity extends Model
{
    use BelongsToTenant;

    protected $table = 'collection_activities';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = [
        'promised_amount' => 'decimal:2',
        'promised_date' => 'date',
        'created_at' => 'datetime',
    ];
    protected $guarded = [];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
