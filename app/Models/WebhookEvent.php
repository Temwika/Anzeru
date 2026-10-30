<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookEvent extends Model
{
    protected $table = 'webhook_events';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;
    protected $casts = ['payload' => 'array', 'signature_valid' => 'boolean', 'created_at' => 'datetime'];
    protected $guarded = [];
}
