<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserBranchAccess extends Model
{
    protected $table = 'user_branch_access';
    public $incrementing = false;
    public $timestamps = false;
    protected $guarded = [];

    public function user() { return $this->belongsTo(User::class); }
    public function branch() { return $this->belongsTo(Branch::class); }
}
