<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * User Management — administrator-account CRUD, activate/deactivate, permanent
 * delete and password reset. Gated to account-managing roles (users.manage), with
 * self-protection on the destructive actions and full activity logging.
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    /** Programming Team — one of the two roles that may manage accounts. */
    private function manager(): User
    {
        return User::factory()->programmingTeam()->create();
    }

    /* ------------------------------------------------------------- role gate */

    public function test_role_without_permission_cannot_reach_user_management(): void
    {
        $admin = User::factory()->create(); // default role: BOD (view-only)

        $this->actingAs($admin)->getJson('/api/admin/users')->assertForbidden();
        $this->actingAs($admin)->postJson('/api/admin/users', [])->assertForbidden();
    }

    public function test_manager_can_list_users(): void
    {
        User::factory()->count(3)->create();

        $this->actingAs($this->manager())
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonCount(4, 'data'); // 3 + the acting manager
    }

    public function test_me_exposes_role_permissions_and_management_flag(): void
    {
        $this->actingAs($this->manager())
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.role', 'programming_team')
            ->assertJsonPath('user.canManageUsers', true)
            ->assertJsonPath('meta.roles.0.value', 'programming_team')
            ->assertJsonFragment(['users.manage']);
    }

    /* -------------------------------------------------------------- creation */

    public function test_create_hashes_password_and_logs(): void
    {
        $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'name' => 'Jane Officer',
                'username' => 'jane',
                'email' => 'jane@example.com',
                'role' => 'secretary',
                'password' => 'secret1234',
                'password_confirmation' => 'secret1234',
            ])
            ->assertCreated()
            ->assertJsonPath('data.username', 'jane')
            ->assertJsonPath('data.isActive', true);

        $user = User::where('username', 'jane')->first();
        $this->assertNotNull($user);
        $this->assertNotSame('secret1234', $user->password);
        $this->assertTrue(Hash::check('secret1234', $user->password));
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_created']);
    }

    public function test_create_rejects_duplicate_username_and_email(): void
    {
        User::factory()->create(['username' => 'taken', 'email' => 'taken@example.com']);

        $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'name' => 'Dup',
                'username' => 'taken',
                'email' => 'taken@example.com',
                'role' => 'secretary',
                'password' => 'secret1234',
                'password_confirmation' => 'secret1234',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['username', 'email']);
    }

    /* ---------------------------------------------------------------- update */

    public function test_update_allows_reusing_own_username(): void
    {
        $target = User::factory()->create(['username' => 'keep', 'email' => 'keep@example.com']);

        $this->actingAs($this->manager())
            ->patchJson("/api/admin/users/{$target->id}", [
                'name' => 'Renamed',
                'username' => 'keep',
                'email' => 'keep@example.com',
                'role' => 'president',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Renamed')
            ->assertJsonPath('data.role', 'president');

        $this->assertDatabaseHas('activity_logs', ['action' => 'user_updated']);
    }

    public function test_cannot_change_own_role(): void
    {
        $me = $this->manager();

        $this->actingAs($me)
            ->patchJson("/api/admin/users/{$me->id}", [
                'name' => $me->name,
                'username' => $me->username,
                'email' => $me->email,
                'role' => 'secretary',
            ])
            ->assertUnprocessable();

        $this->assertSame(UserRole::ProgrammingTeam, $me->fresh()->role);
    }

    /* ---------------------------------------------------- activate/deactivate */

    public function test_toggle_active_deactivates_and_reactivates(): void
    {
        $target = User::factory()->create();
        $me = $this->manager();

        $this->actingAs($me)->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.isActive', false);
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_deactivated']);

        $this->actingAs($me)->postJson("/api/admin/users/{$target->id}/toggle-active")
            ->assertOk()
            ->assertJsonPath('data.isActive', true);
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_activated']);
    }

    public function test_cannot_deactivate_self(): void
    {
        $me = $this->manager();

        $this->actingAs($me)->postJson("/api/admin/users/{$me->id}/toggle-active")
            ->assertUnprocessable();

        $this->assertTrue($me->fresh()->is_active);
    }

    /* -------------------------------------------------------- password reset */

    public function test_reset_password_changes_the_hash_and_logs(): void
    {
        $target = User::factory()->create();

        $this->actingAs($this->manager())
            ->postJson("/api/admin/users/{$target->id}/reset-password", [
                'password' => 'brandnew123',
                'password_confirmation' => 'brandnew123',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('brandnew123', $target->fresh()->password));
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_reset']);
    }

    /* --------------------------------------------------------------- destroy */

    public function test_delete_removes_the_account_and_logs(): void
    {
        $target = User::factory()->create();

        $this->actingAs($this->manager())
            ->deleteJson("/api/admin/users/{$target->id}")
            ->assertOk();

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_deleted']);
    }

    public function test_cannot_delete_self(): void
    {
        $me = $this->manager();

        $this->actingAs($me)->deleteJson("/api/admin/users/{$me->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('users', ['id' => $me->id]);
    }

    /* ----------------------------------------------------------------- login */

    public function test_deactivated_account_cannot_log_in(): void
    {
        $user = User::factory()->inactive()->create(['email' => 'off@example.com']);
        $user->forceFill(['password' => bcrypt('secret1234')])->save();

        $this->postJson('/auth/admin/login', ['email' => 'off@example.com', 'password' => 'secret1234'])
            ->assertForbidden();

        $this->assertGuest();
    }
}
