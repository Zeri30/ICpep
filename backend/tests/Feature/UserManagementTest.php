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

    /** Programming Team — the only role that may manage accounts. */
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

    public function test_create_composes_the_name_generates_a_password_and_logs(): void
    {
        $response = $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'first_name' => 'Jane',
                'middle_initial' => 's',
                'last_name' => 'Officer',
                'email' => 'jane@example.com',
                'role' => 'secretary',
            ])
            ->assertCreated()
            // The form captures the parts; the displayed name is composed from
            // them, with the middle initial upper-cased and punctuated.
            ->assertJsonPath('data.name', 'Jane S. Officer')
            ->assertJsonPath('data.isActive', true)
            // Handed back once, so whoever created the account can pass it on.
            // Always lowercase, independent of the name's own display case.
            ->assertJsonPath('generatedPassword', 'jane.officer.s');

        $user = User::where('email', 'jane@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('Jane', $user->first_name);
        $this->assertSame('Officer', $user->last_name);
        $this->assertTrue($user->must_change_password);
        $this->assertTrue(Hash::check($response->json('generatedPassword'), $user->password));
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_created']);
    }

    public function test_create_composes_the_name_without_a_middle_initial(): void
    {
        $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'first_name' => 'Jane',
                'last_name' => 'Officer',
                'email' => 'jane@example.com',
                'role' => 'secretary',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Jane Officer')
            // No middle initial in the name, none in the generated password.
            ->assertJsonPath('generatedPassword', 'jane.officer');
    }

    public function test_create_requires_the_name_parts_and_rejects_a_duplicate_email(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'email' => 'taken@example.com',
                'role' => 'secretary',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email']);
    }

    /* ---------------------------------------------------------------- update */

    public function test_update_allows_reusing_own_email(): void
    {
        $target = User::factory()->create(['email' => 'keep@example.com']);

        $this->actingAs($this->manager())
            ->patchJson("/api/admin/users/{$target->id}", [
                'first_name' => 'Re',
                'last_name' => 'Named',
                'email' => 'keep@example.com',
                'role' => 'president',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Re Named')
            ->assertJsonPath('data.role', 'president');

        $this->assertDatabaseHas('activity_logs', ['action' => 'user_updated']);
    }

    public function test_cannot_change_own_role(): void
    {
        $me = $this->manager();

        // Everything else in the payload is valid, so the 422 can only be the
        // self-lockout guard rather than a stray validation failure.
        $this->actingAs($me)
            ->patchJson("/api/admin/users/{$me->id}", [
                'first_name' => $me->first_name,
                'last_name' => $me->last_name,
                'email' => $me->email,
                'role' => 'secretary',
            ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'You cannot change your own role.');

        $this->assertSame(UserRole::ProgrammingTeam, $me->fresh()->role);
    }

    /** The guard is on changing your *role*, not on editing yourself at all. */
    public function test_can_edit_own_account_while_keeping_the_same_role(): void
    {
        $me = $this->manager();

        $this->actingAs($me)
            ->patchJson("/api/admin/users/{$me->id}", [
                'first_name' => 'Still',
                'last_name' => 'Me',
                'email' => $me->email,
                'role' => $me->role->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Still Me');
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

    public function test_reset_password_generates_a_first_login_password_and_forces_a_change(): void
    {
        $target = User::factory()->create([
            'first_name' => 'Jane',
            'middle_initial' => 's',
            'last_name' => 'Officer',
        ]);

        $response = $this->actingAs($this->manager())
            ->postJson("/api/admin/users/{$target->id}/reset-password")
            ->assertOk()
            // Generated the same way account creation does — lowercase, spaces
            // collapsed — and handed back once so it can be passed along.
            ->assertJsonPath('generatedPassword', 'jane.officer.s');

        $fresh = $target->fresh();
        $this->assertTrue(Hash::check('jane.officer.s', $fresh->password));
        // Put back into the same first-login state a newly created account
        // starts in.
        $this->assertTrue($fresh->must_change_password);
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
