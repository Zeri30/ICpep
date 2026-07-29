<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds a default administrator account for every role, so each position has a
 * ready-to-use login for testing and initial rollout. Active, verified, with a
 * shared default password taken from the environment.
 *
 * Set SEED_DEFAULT_PASSWORD in .env; the default here is only a placeholder and
 * every seeded account SHOULD have its password changed on first sign-in.
 *
 * **Existing accounts are left alone.** The seeder is re-run whenever a role is
 * added — six Team Heads arrived that way — and by then the accounts it created
 * on an earlier run are in use: officers have signed in, changed the password,
 * and had their real name typed over the placeholder. An account is therefore
 * created or skipped, never updated. It used to be an updateOrCreate, which
 * would have reset all of that on the run that added one new role.
 */
class RoleAccountsSeeder extends Seeder
{
    /** Email domain for the seeded accounts. */
    private const DOMAIN = 'icpep.se';

    /**
     * Roles the organization fills more than once, and how many seats each has.
     *
     * The chapter has four directors on the board, so `bod` needs four accounts
     * rather than one. Seat 1 keeps the plain address (`bod@`) it has always had;
     * the rest are numbered (`bod.2@`, `bod.3@`, `bod.4@`) — so adding seats
     * never renames an account somebody is already signing in with.
     *
     * A role absent from this list has a single seat.
     */
    private const SEATS = [
        'bod' => 4,
    ];

    public function run(): void
    {
        $password = env('SEED_DEFAULT_PASSWORD', 'ChangeMe!2026');
        $hash = Hash::make($password);

        $created = 0;
        $existing = 0;

        foreach (UserRole::cases() as $role) {
            // e.g. assistant_treasurer → assistant.treasurer,
            //      programming_team_head → programming.team.head
            $base = str_replace('_', '.', $role->value);

            for ($seat = 1; $seat <= (self::SEATS[$role->value] ?? 1); $seat++) {
                $username = $seat === 1 ? $base : "{$base}.{$seat}";
                $email = "{$username}@".self::DOMAIN;

                // firstOrCreate, not updateOrCreate: see the class note. The
                // email is the identity, so a seat already seeded is a no-op
                // however many times this runs.
                $account = User::firstOrCreate(
                    ['email' => $email],
                    [
                        // A placeholder standing in for the officer's real name,
                        // which is typed in through User Management. The role
                        // label alone for a single-seat role; numbered where
                        // there are several, so four directors are four
                        // distinguishable rows and not four identical ones.
                        //
                        // The surname is left empty rather than invented: there
                        // is no real one to guess, and the account form requires
                        // both parts, so whoever fills the name in has to supply
                        // a surname and cannot leave a fabricated one standing.
                        'name' => $seat === 1 ? $role->label() : "{$role->label()} {$seat}",
                        'first_name' => $seat === 1 ? $role->label() : "{$role->label()} {$seat}",
                        'middle_initial' => null,
                        'last_name' => '',
                        'username' => $username,
                        'password' => $hash,
                        'role' => $role,
                        'is_active' => true,
                        'email_verified_at' => now(),
                    ],
                );

                $account->wasRecentlyCreated ? $created++ : $existing++;
            }
        }

        $this->command->info(
            "Role accounts (@".self::DOMAIN."): {$created} created, {$existing} already present and left untouched."
        );

        if ($created > 0) {
            $this->command->info('Default password for the new accounts: "'.$password.'" — change it after first sign-in.');
        }
    }
}
