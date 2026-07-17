<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds one default administrator account for every role, so each position has a
 * ready-to-use login for testing and initial rollout. Idempotent (updateOrCreate
 * by email), active, with a shared default password taken from the environment.
 *
 * Set SEED_DEFAULT_PASSWORD in .env; the default here is only a placeholder and
 * every seeded account SHOULD have its password changed on first sign-in.
 */
class RoleAccountsSeeder extends Seeder
{
    /** Email domain for the seeded accounts. */
    private const DOMAIN = 'icpep.se';

    public function run(): void
    {
        $password = env('SEED_DEFAULT_PASSWORD', 'ChangeMe!2026');
        $hash = Hash::make($password);

        foreach (UserRole::cases() as $role) {
            $username = str_replace('_', '.', $role->value);   // e.g. assistant_treasurer → assistant.treasurer

            User::updateOrCreate(
                ['email' => "{$username}@".self::DOMAIN],
                [
                    'name' => $role->label(),
                    'username' => $username,
                    'password' => $hash,
                    'role' => $role,
                    'is_active' => true,
                    'email_verified_at' => now(),
                ],
            );
        }

        $this->command->info('Seeded one account per role (@'.self::DOMAIN.'). Default password: "'.$password.'" — change it after first sign-in.');
    }
}
