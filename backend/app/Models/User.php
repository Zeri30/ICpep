<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Permission;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Every row in this table is an officer/administrator account (the public
     * membership lives in `applications`), so reaching the admin comes down to
     * the account still being active. Enforced by the EnsureAdmin middleware on
     * the JSON admin API.
     */
    public function canAccessAdmin(): bool
    {
        return (bool) $this->is_active;
    }

    /**
     * Does this (active) account hold the given ability? The role's permission
     * set is the source of truth; every Gate resolves through here.
     */
    public function hasPermission(Permission $permission): bool
    {
        return $this->is_active && (bool) $this->role?->hasPermission($permission);
    }

    /**
     * May this account manage the other administrator accounts? Gated on the
     * /users routes and used to hide User Management in the UI.
     */
    public function canManageUsers(): bool
    {
        return $this->hasPermission(Permission::ManageUsers);
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'is_active',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'role' => UserRole::class,
            'password' => 'hashed',
        ];
    }
}
