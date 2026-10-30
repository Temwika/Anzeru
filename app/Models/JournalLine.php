<?php

namespace App\Models;

use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Model;

class JournalLine extends Model
{
    use BelongsToTenant;

    protected $table = 'journal_lines';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['debit' => 'decimal:2', 'credit' => 'decimal:2'];
    protected $guarded = [];

    public function entry() { return $this->belongsTo(JournalEntry::class, 'entry_id'); }
    public function account() { return $this->belongsTo(ChartOfAccount::class, 'account_id'); }
}
