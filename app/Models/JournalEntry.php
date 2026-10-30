<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class JournalEntry extends Model
{
    use BelongsToTenant;

    protected $table = 'journal_entries';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['entry_date' => 'date', 'created_at' => 'datetime'];
    protected $guarded = [];

    public function lines() { return $this->hasMany(JournalLine::class, 'entry_id'); }
    public function poster() { return $this->belongsTo(User::class, 'posted_by'); }
}
