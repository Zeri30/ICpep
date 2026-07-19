<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Create (or update) the admin account used to sign into the admin.
     * Credentials come from .env (ADMIN_EMAIL / ADMIN_PASSWORD) so they are
     * never committed to source control.
     */
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (! $email || ! $password) {
            $this->command->warn('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — skipping admin user.');

            return;
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => env('ADMIN_NAME', 'ICpEP.SE Admin'),
                'username' => env('ADMIN_USERNAME', 'admin'),
                'password' => Hash::make($password),
                // The bootstrap account belongs to the Programming Team — the
                // only role that can manage the other officer accounts.
                'role' => \App\Enums\UserRole::ProgrammingTeam,
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $this->command->info("Admin user ready: {$email}");
    }
}
