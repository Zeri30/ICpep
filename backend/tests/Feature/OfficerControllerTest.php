<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public board (GET /api/officers) — no auth, read from the same `users`
 * table User Management edits. See App\Http\Controllers\OfficerController.
 */
class OfficerControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_requires_no_authentication(): void
    {
        User::factory()->role(UserRole::President)->create(['name' => 'Archie Baltazar']);

        $this->getJson('/api/officers')->assertOk();
    }

    public function test_it_lists_the_board_in_roster_order_with_the_adviser_first(): void
    {
        // Created out of roster order, to prove the response reorders rather
        // than echoing insertion order.
        User::factory()->role(UserRole::Bod)->create(['name' => 'A Director']);
        User::factory()->role(UserRole::President)->create(['name' => 'The President']);
        User::factory()->role(UserRole::Adviser)->create(['name' => 'The Adviser']);

        $roles = $this->getJson('/api/officers')->assertOk()->json('data.*.role');

        $this->assertSame(['adviser', 'president', 'bod'], $roles);
    }

    public function test_it_excludes_roles_that_are_not_part_of_the_public_board(): void
    {
        User::factory()->role(UserRole::ProgrammingTeam)->create();
        User::factory()->role(UserRole::ProgrammingTeamHead)->create();
        User::factory()->role(UserRole::EsportsTeamHead)->create();
        User::factory()->role(UserRole::President)->create(['name' => 'The President']);

        $roles = $this->getJson('/api/officers')->assertOk()->json('data.*.role');

        $this->assertSame(['president'], $roles);
    }

    public function test_it_excludes_deactivated_accounts(): void
    {
        User::factory()->role(UserRole::President)->create(['is_active' => false]);

        $this->getJson('/api/officers')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_multiple_seats_of_the_same_role_keep_creation_order(): void
    {
        $first = User::factory()->role(UserRole::Bod)->create(['name' => 'First Director']);
        $second = User::factory()->role(UserRole::Bod)->create(['name' => 'Second Director']);

        $names = $this->getJson('/api/officers')->assertOk()->json('data.*.name');

        $this->assertSame([$first->name, $second->name], $names);
    }

    public function test_a_row_carries_what_the_public_board_needs(): void
    {
        User::factory()->role(UserRole::President)->create(['name' => 'Archie Baltazar', 'email' => 'president@icpep.se']);

        $this->getJson('/api/officers')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Archie Baltazar')
            ->assertJsonPath('data.0.email', 'president@icpep.se')
            ->assertJsonPath('data.0.role', 'president')
            ->assertJsonPath('data.0.roleLabel', 'President')
            ->assertJsonPath('data.0.isAdviser', false);
    }
}
