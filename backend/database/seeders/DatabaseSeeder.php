<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // The real Programming Team account, from .env credentials.
        $this->call(AdminUserSeeder::class);
        // One ready-to-use account per role (shared default password).
        $this->call(RoleAccountsSeeder::class);
    }
}
