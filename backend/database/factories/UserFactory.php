<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'username' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            // Default to the least-privilege, view-only role; tests opt into a
            // more capable role explicitly via ->role()/->programmingTeam()/etc.
            'role' => \App\Enums\UserRole::Bod,
            'is_active' => true,
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }

    /** Assign a specific role. */
    public function role(\App\Enums\UserRole $role): static
    {
        return $this->state(fn (array $attributes) => ['role' => $role]);
    }

    /** Programming Team — full non-financial access plus account management. */
    public function programmingTeam(): static
    {
        return $this->role(\App\Enums\UserRole::ProgrammingTeam);
    }

    /** Treasurer — payment status and the financial modules. */
    public function treasurer(): static
    {
        return $this->role(\App\Enums\UserRole::Treasurer);
    }

    /** A deactivated account (cannot sign in / reach the admin). */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_active' => false,
        ]);
    }
}
