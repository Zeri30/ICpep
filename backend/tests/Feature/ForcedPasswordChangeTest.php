<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * The forced first-login password change: a newly created account starts on
 * a system-generated password and must replace it — with a genuinely
 * different one — before reaching anything else in the admin.
 */
class ForcedPasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): User
    {
        return User::factory()->programmingTeam()->create();
    }

    /** Creates the account as the manager, then signs in as it. Returns the generated password. */
    private function createAndSignIn(): string
    {
        $generated = $this->actingAs($this->manager())
            ->postJson('/api/admin/users', [
                'first_name' => 'Jane',
                'last_name' => 'Officer',
                'email' => 'jane@example.com',
                'role' => 'secretary',
            ])
            ->assertCreated()
            ->json('generatedPassword');

        $this->postJson('/auth/admin/login', [
            'email' => 'jane@example.com',
            'password' => $generated,
        ])->assertOk();

        return $generated;
    }

    public function test_new_account_can_sign_in_with_the_generated_password(): void
    {
        $this->createAndSignIn();

        $this->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.mustChangePassword', true);
    }

    public function test_must_change_password_locks_out_every_other_endpoint(): void
    {
        $this->createAndSignIn();

        // Dashboard is open to any active administrator regardless of role —
        // picked so the lockout is unambiguously the reason for the refusal,
        // not a permission jane's role happens not to hold.
        $this->getJson('/api/admin/dashboard')
            ->assertStatus(423)
            ->assertJsonPath('mustChangePassword', true);

        // /me stays reachable — it's how the frontend learns the flag is set
        // and gets the officer's own email for the change-password screen.
        $this->getJson('/api/admin/me')->assertOk();
    }

    public function test_changing_the_password_clears_the_flag_and_replaces_the_default(): void
    {
        $default = $this->createAndSignIn();

        $this->postJson('/api/admin/me/password', [
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertOk();

        $user = User::where('email', 'jane@example.com')->first();
        $this->assertFalse($user->must_change_password);
        $this->assertTrue(Hash::check('a-brand-new-password', $user->password));

        // Unlocked now: the endpoint that was refusing a moment ago works.
        $this->getJson('/api/admin/dashboard')->assertOk();

        $this->postJson('/auth/admin/logout');
        $this->assertGuest();

        // The default password is dead; the officer's own new one works.
        $this->postJson('/auth/admin/login', [
            'email' => 'jane@example.com',
            'password' => $default,
        ])->assertUnprocessable();

        $this->postJson('/auth/admin/login', [
            'email' => 'jane@example.com',
            'password' => 'a-brand-new-password',
        ])->assertOk();
    }

    public function test_the_new_password_must_differ_from_the_generated_one(): void
    {
        $default = $this->createAndSignIn();

        $this->postJson('/api/admin/me/password', [
            'password' => $default,
            'password_confirmation' => $default,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password']);
    }
}
