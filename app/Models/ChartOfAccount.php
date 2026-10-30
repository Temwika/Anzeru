<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class ChartOfAccount extends Model
{
    use BelongsToTenant;

    protected $table = 'chart_of_accounts';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $guarded = [];

    public function tenant() { return $this->belongsTo(Tenant::class); }
    public function lines() { return $this->hasMany(JournalLine::class, 'account_id'); }
}
