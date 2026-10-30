<?php

namespace App\Models;

use Filament\Models\Contracts\FilamentUser;
use Filament\Models\Contracts\HasName;
use Filament\Panel;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements FilamentUser, HasName
{
    use Notifiable, HasRoles;

    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    // Map Laravel's expected 'password' field to our 'password_hash' column
    protected $authPasswordName = 'password_hash';

    protected $guarded = [];
    protected $hidden = ['password_hash', 'mfa_secret', 'remember_token'];
    protected $casts = [
        'approval_limit' => 'decimal:2',
        'is_active' => 'boolean',
        'mfa_enabled' => 'boolean',
        'failed_logins' => 'integer',
        'locked_until' => 'datetime',
        'last_login_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    // Required by Laravel Auth
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function tenant() { return $this->belongsTo(Tenant::class); }

    public function branchAccess() { return $this->hasMany(UserBranchAccess::class); }
    public function branches() { return $this->belongsToMany(Branch::class, 'user_branch_access'); }

    public function isLocked(): bool
    {
        return $this->locked_until && $this->locked_until->isFuture();
    }

    public function isBranchScoped(): bool
    {
        return in_array($this->role, ['credit_officer', 'credit_manager', 'cashier']);
    }

    public function isPlatformAdmin(): bool
    {
        return $this->role === 'platform_admin';
    }

    public function isBorrower(): bool
    {
        return $this->role === 'borrower';
    }

    public function getFilamentName(): string
    {
        return $this->full_name;
    }

    public function canAccessPanel(Panel $panel): bool
    {
        if ($panel->getId() === 'platform') {
            return $this->role === 'platform_admin';
        }
        if ($panel->getId() === 'borrower') {
            return $this->role === 'borrower';
        }
        // Staff panel — all non-borrower, non-platform staff
        return !in_array($this->role, ['platform_admin', 'borrower']) && $this->is_active;
    }

}
