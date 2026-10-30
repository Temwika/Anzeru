<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';
    protected $primaryKey = 'seq';
    public $incrementing = true;
    protected $keyType = 'int';
    public $timestamps = false;
    protected $casts = ['data' => 'array', 'created_at' => 'datetime'];
    protected $guarded = [];
}
