<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
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
            ->assertJsonPath('data.isActive', true);

        // Handed back once, so whoever created the account can pass it on —
        // a random string, not derived from the officer's name (see
        // UserController::generateDefaultPassword).
        $generated = $response->json('generatedPassword');
        $this->assertIsString($generated);
        $this->assertSame(16, strlen($generated));
        $this->assertNotSame('jane.officer.s', mb_strtolower($generated));

        $user = User::where('email', 'jane@example.com')->first();
        $this->assertNotNull($user);
        $this->assertSame('Jane', $user->first_name);
        $this->assertSame('Officer', $user->last_name);
        $this->assertTrue($user->must_change_password);
        $this->assertTrue(Hash::check($generated, $user->password));
        $this->assertDatabaseHas('activity_logs', ['action' => 'user_created']);
    }

    public function test_create_composes_the_name_without_a_middle_initial(): void
    {
        $response = $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'first_name' => 'Jane',
                'last_name' => 'Officer',
                'email' => 'jane@example.com',
                'role' => 'secretary',
            ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Jane Officer');

        // The generated password doesn't depend on the name parts at all,
        // middle initial included — it's random either way.
        $this->assertSame(16, strlen($response->json('generatedPassword')));
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

    /* --------------------------------------------------- log out all admins */

    /** Regression test for the scoping bug: the endpoint used to exclude only
     *  the one session id that clicked it, so a caller signed in on more than
     *  one device lost their own other sessions too — contrary to the
     *  endpoint's own promise to keep "the one making this request" signed
     *  in, not just "the one tab". */
    public function test_logout_all_admins_keeps_every_device_of_the_caller(): void
    {
        $me = $this->manager();
        $other = User::factory()->create();

        DB::table('sessions')->insert([
            ['id' => 'me-device-a', 'user_id' => $me->id, 'payload' => 'x', 'last_activity' => time()],
            ['id' => 'me-device-b', 'user_id' => $me->id, 'payload' => 'y', 'last_activity' => time()],
            ['id' => 'other-device', 'user_id' => $other->id, 'payload' => 'z', 'last_activity' => time()],
        ]);

        $this->actingAs($me)
            ->postJson('/api/admin/users/logout-all-sessions')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertSame(2, DB::table('sessions')->where('user_id', $me->id)->count());
        $this->assertSame(0, DB::table('sessions')->where('user_id', $other->id)->count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'users_logged_out_all']);
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
            ->assertOk();

        // Generated the same random way account creation does, not derived
        // from the account's name — and handed back once so it can be
        // passed along.
        $generated = $response->json('generatedPassword');
        $this->assertIsString($generated);
        $this->assertSame(16, strlen($generated));

        $fresh = $target->fresh();
        $this->assertTrue(Hash::check($generated, $fresh->password));
        // Put back into the same first-login state a newly created account
        // starts in.
        $this->assertTrue($fresh->must_change_password);
        $this->assertDatabaseHas('activity_logs', ['action' => 'password_reset']);
    }

    public function test_reset_password_refuses_a_second_reset_within_the_cooldown(): void
    {
        $target = User::factory()->create(['password_reset_at' => now()]);
        $manager = $this->manager();

        $originalHash = $target->password;

        $this->actingAs($manager)
            ->postJson("/api/admin/users/{$target->id}/reset-password")
            ->assertUnprocessable()
            ->assertJsonStructure(['message', 'availableAt']);

        // Refused before ever touching the account.
        $this->assertSame($originalHash, $target->fresh()->password);

        // The list surfaces the same cooldown so the UI can warn up front.
        $this->actingAs($manager)
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath(
                'data.0.resetAvailableAt',
                fn ($value) => $value !== null,
            );
    }

    public function test_reset_password_is_allowed_again_after_the_cooldown(): void
    {
        $target = User::factory()->create([
            'first_name' => 'Jane',
            'middle_initial' => 's',
            'last_name' => 'Officer',
            'password_reset_at' => now()->subDays(7)->subMinute(),
        ]);

        $response = $this->actingAs($this->manager())
            ->postJson("/api/admin/users/{$target->id}/reset-password")
            ->assertOk();

        $this->assertSame(16, strlen($response->json('generatedPassword')));
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
