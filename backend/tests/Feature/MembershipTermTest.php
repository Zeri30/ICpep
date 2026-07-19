<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\RegistrationSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The membership cycle: one independent list per semester, exactly one of them
 * current, and a manually controlled public form that always files applicants
 * under whichever list is current at the time they submit.
 */
class MembershipTermTest extends TestCase
{
    use RefreshDatabase;

    private function acting(UserRole $role): User
    {
        return User::factory()->role($role)->create();
    }

    /** Someone who can roll the cycle over. */
    private function officer(): User
    {
        return $this->acting(UserRole::President);
    }

    private function term(int $from, int $semester, bool $current = false): MembershipTerm
    {
        return MembershipTerm::factory()->term($from, $semester)->when($current, fn ($f) => $f->current())->create();
    }

    private function member(?MembershipTerm $term = null, string $surname = 'Dela Cruz'): Application
    {
        return Application::create([
            'membership_term_id' => $term?->id,
            'surname' => $surname, 'given_name' => 'Juan', 'middle_initial' => 'S',
            'year_level' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-01-01',
            'address' => '123 Rizal St', 'email' => 'juan@example.com', 'phone' => '09123456789',
            'signature_path' => 'signatures/x.png', 'picture_path' => 'pictures/x.png',
        ]);
    }

    /* ------------------------------------------------------- the backfilled term */

    public function test_migration_seeds_a_current_term_and_an_open_form(): void
    {
        $term = MembershipTerm::current();

        $this->assertNotNull($term);
        $this->assertSame('2026–2027 Semester 1', $term->label);
        $this->assertTrue(RegistrationSetting::instance()->is_open);
    }

    /* ----------------------------------------------------------- creating lists */

    public function test_creating_a_list_leaves_existing_records_untouched(): void
    {
        $existing = MembershipTerm::current();
        $this->member($existing);

        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2027, 'schoolYearTo' => 2028, 'semester' => 1,
            ])
            ->assertCreated()
            ->assertJsonPath('label', '2027–2028 Semester 1')
            ->assertJsonPath('isCurrent', false)
            ->assertJsonPath('memberCount', 0);

        // The old list keeps its member and stays the active one.
        $this->assertSame(1, $existing->fresh()->applications()->count());
        $this->assertTrue($existing->fresh()->is_current);
    }

    public function test_creating_with_set_current_redirects_new_registrations(): void
    {
        $previous = MembershipTerm::current();

        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2027, 'schoolYearTo' => 2028, 'semester' => 1, 'setCurrent' => true,
            ])
            ->assertCreated()
            ->assertJsonPath('isCurrent', true);

        $this->assertFalse($previous->fresh()->is_current);
        $this->assertSame('2027–2028 Semester 1', MembershipTerm::current()->label);
    }

    public function test_a_school_year_semester_cannot_be_created_twice(): void
    {
        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2026, 'schoolYearTo' => 2027, 'semester' => 1,
            ])
            ->assertJsonValidationErrors('semester');
    }

    public function test_a_list_cannot_start_before_the_current_one(): void
    {
        // Current is 2026–2027 Sem 1 (seeded by the migration).
        $officer = $this->officer();

        // An earlier school year.
        $this->actingAs($officer)
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2025, 'schoolYearTo' => 2026, 'semester' => 1,
            ])
            ->assertJsonValidationErrors('schoolYearFrom');

        $this->assertSame(1, MembershipTerm::count());
    }

    public function test_an_earlier_semester_of_the_current_year_is_refused(): void
    {
        // Move the cycle to Semester 2, then try to go back to Semester 1.
        $second = $this->term(2026, 2);
        $this->actingAs($this->officer())->postJson("/api/admin/terms/{$second->id}/activate")->assertOk();

        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2026, 'schoolYearTo' => 2027, 'semester' => 1,
            ])
            // Sem 1 of 2026 already exists, so the duplicate rule answers first —
            // either way the list is not created.
            ->assertStatus(422);
    }

    public function test_a_later_list_is_still_allowed(): void
    {
        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2030, 'schoolYearTo' => 2031, 'semester' => 2,
            ])
            ->assertCreated();
    }

    public function test_a_school_year_must_span_consecutive_years(): void
    {
        $this->actingAs($this->officer())
            ->postJson('/api/admin/terms', [
                'schoolYearFrom' => 2027, 'schoolYearTo' => 2030, 'semester' => 1,
            ])
            ->assertJsonValidationErrors('schoolYearTo');
    }

    public function test_only_one_list_is_ever_current(): void
    {
        $a = $this->term(2027, 1);
        $b = $this->term(2027, 2);

        $this->actingAs($this->officer())->postJson("/api/admin/terms/{$a->id}/activate")->assertOk();
        $this->actingAs($this->officer())->postJson("/api/admin/terms/{$b->id}/activate")->assertOk();

        $this->assertSame(1, MembershipTerm::where('is_current', true)->count());
        $this->assertTrue($b->fresh()->is_current);
    }

    public function test_the_selector_lists_the_current_term_first(): void
    {
        $this->term(2024, 1);
        $older = $this->term(2025, 2);

        // Activate an older list — recency must not outrank being current.
        $this->actingAs($this->officer())->postJson("/api/admin/terms/{$older->id}/activate")->assertOk();

        $this->actingAs($this->officer())
            ->getJson('/api/admin/terms')
            ->assertOk()
            ->assertJsonPath('data.0.label', '2025–2026 Semester 2')
            ->assertJsonPath('data.0.isCurrent', true);
    }

    /* --------------------------------------------------------------- RBAC */

    public function test_only_executive_roles_and_the_programming_team_manage_the_cycle(): void
    {
        $allowed = [UserRole::ProgrammingTeam, UserRole::President, UserRole::Vpea, UserRole::Vpia];

        foreach ($allowed as $role) {
            $this->actingAs($this->acting($role))
                ->postJson('/api/admin/registration/close', ['reason' => 'Semestral Break'])
                ->assertOk();
        }

        foreach (UserRole::cases() as $role) {
            if (in_array($role, $allowed, true)) {
                continue;
            }

            $this->actingAs($this->acting($role))
                ->postJson('/api/admin/registration/close', ['reason' => 'Semestral Break'])
                ->assertForbidden();

            $this->actingAs($this->acting($role))
                ->postJson('/api/admin/terms', [
                    'schoolYearFrom' => 2030, 'schoolYearTo' => 2031, 'semester' => 1,
                ])
                ->assertForbidden();
        }
    }

    public function test_every_role_can_read_the_list_selector(): void
    {
        foreach (UserRole::cases() as $role) {
            $this->actingAs($this->acting($role))->getJson('/api/admin/terms')->assertOk();
        }
    }

    /* -------------------------------------------------------- list separation */

    public function test_members_are_scoped_to_the_selected_list(): void
    {
        Storage::fake('supabase');

        $current = MembershipTerm::current();
        $past = $this->term(2025, 2);

        $this->member($current, 'Current');
        $this->member($past, 'Historical');

        $officer = $this->officer();

        // No term named → the current list.
        $this->actingAs($officer)->getJson('/api/admin/members')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.surname', 'Current');

        // A past list stays readable for record keeping.
        $this->actingAs($officer)->getJson("/api/admin/members?term={$past->id}")
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.surname', 'Historical');
    }

    public function test_the_dashboard_counts_only_the_selected_list(): void
    {
        $current = MembershipTerm::current();
        $past = $this->term(2025, 2);

        $this->member($current, 'Current');
        $this->member($past, 'Historical');
        $this->member($past, 'AlsoHistorical');

        $officer = $this->officer();

        $this->actingAs($officer)->getJson('/api/admin/dashboard')
            ->assertOk()->assertJsonPath('stats.members', 1);

        $this->actingAs($officer)->getJson("/api/admin/dashboard?term={$past->id}")
            ->assertOk()->assertJsonPath('stats.members', 2);
    }

    public function test_payment_history_stays_with_the_term_the_fee_was_paid_in(): void
    {
        $past = $this->term(2025, 2);
        $member = $this->member($past);

        $this->actingAs($this->acting(UserRole::Treasurer))
            ->postJson("/api/admin/members/{$member->id}/toggle-paid")
            ->assertOk();

        $treasurer = $this->acting(UserRole::Treasurer);

        // The fee belongs to the member's own semester, not the current one.
        $this->actingAs($treasurer)->getJson('/api/admin/payments')
            ->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($treasurer)->getJson("/api/admin/payments?term={$past->id}")
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_payment_filters_and_search_stay_within_the_selected_list(): void
    {
        $current = MembershipTerm::current();
        $past = $this->term(2025, 2);

        $here = $this->member($current, 'Reyes');
        $there = $this->member($past, 'Reyes');

        $treasurer = $this->acting(UserRole::Treasurer);
        $this->actingAs($treasurer)->postJson("/api/admin/members/{$here->id}/toggle-paid")->assertOk();
        $this->actingAs($treasurer)->postJson("/api/admin/members/{$there->id}/toggle-paid")->assertOk();

        // A search matching both members still answers only for the chosen list.
        $this->actingAs($treasurer)->getJson('/api/admin/payments?search=Reyes')
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($treasurer)->getJson("/api/admin/payments?term={$past->id}&search=Reyes&action=paid")
            ->assertOk()->assertJsonCount(1, 'data');

        // ...and a filter that matches nothing in that list stays empty rather
        // than falling back to the other one.
        $this->actingAs($treasurer)->getJson("/api/admin/payments?term={$past->id}&action=revoked")
            ->assertOk()->assertJsonCount(0, 'data');
    }

    /* ------------------------------------------------ opening / closing the form */

    public function test_closing_requires_a_reason_and_surfaces_it_publicly(): void
    {
        $this->actingAs($this->officer())
            ->postJson('/api/admin/registration/close', [])
            ->assertJsonValidationErrors('reason');

        $this->actingAs($this->officer())
            ->postJson('/api/admin/registration/close', ['reason' => 'End of School Year'])
            ->assertOk()
            ->assertJsonPath('isOpen', false);

        $this->getJson('/api/registration-status')
            ->assertOk()
            ->assertJsonPath('isOpen', false)
            ->assertJsonPath('reason', 'End of School Year');
    }

    public function test_a_closed_form_refuses_submissions_with_the_reason(): void
    {
        Storage::fake('supabase');

        $this->actingAs($this->officer())
            ->postJson('/api/admin/registration/close', ['reason' => 'Semestral Break']);

        $this->postJson('/api/applications', $this->applicationPayload())
            ->assertForbidden()
            ->assertJsonPath('reason', 'Semestral Break')
            ->assertJsonPath('registrationClosed', true);

        $this->assertSame(0, Application::count());
    }

    public function test_reopening_clears_the_reason(): void
    {
        $officer = $this->officer();

        $this->actingAs($officer)->postJson('/api/admin/registration/close', ['reason' => 'Technical Issue']);
        $this->actingAs($officer)->postJson('/api/admin/registration/open')->assertOk()->assertJsonPath('isOpen', true);

        $this->getJson('/api/registration-status')
            ->assertOk()
            ->assertJsonPath('isOpen', true)
            ->assertJsonPath('reason', null);
    }

    /* ------------------------------------------- where reopened registrations land */

    /** Example 1: no new list created — applicants keep joining the same one. */
    public function test_reopening_without_a_new_list_keeps_the_same_destination(): void
    {
        Storage::fake('supabase');

        $current = MembershipTerm::current();
        $officer = $this->officer();

        $this->actingAs($officer)->postJson('/api/admin/registration/close', ['reason' => 'Semestral Break']);
        $this->actingAs($officer)->postJson('/api/admin/registration/open');

        $this->postJson('/api/applications', $this->applicationPayload())->assertCreated();

        $this->assertSame($current->id, Application::first()->membership_term_id);
    }

    /** Example 2: a new list is created and activated — applicants follow it. */
    public function test_reopening_after_a_rollover_sends_applicants_to_the_new_list(): void
    {
        Storage::fake('supabase');

        $previous = MembershipTerm::current();
        $officer = $this->officer();

        $this->actingAs($officer)->postJson('/api/admin/registration/close', ['reason' => 'End of School Year']);
        $this->actingAs($officer)->postJson('/api/admin/terms', [
            'schoolYearFrom' => 2027, 'schoolYearTo' => 2028, 'semester' => 1, 'setCurrent' => true,
        ])->assertCreated();
        $this->actingAs($officer)->postJson('/api/admin/registration/open');

        $this->postJson('/api/applications', $this->applicationPayload())->assertCreated();

        $new = MembershipTerm::current();
        $this->assertSame('2027–2028 Semester 1', $new->label);
        $this->assertSame($new->id, Application::first()->membership_term_id);
        // The list it replaced receives nothing further.
        $this->assertSame(0, $previous->fresh()->applications()->count());
    }

    /** The destination follows the *active* list, not the most recently created. */
    public function test_a_created_but_inactive_list_never_receives_applicants(): void
    {
        Storage::fake('supabase');

        $current = MembershipTerm::current();

        // Created ahead of time, deliberately not activated.
        $this->actingAs($this->officer())->postJson('/api/admin/terms', [
            'schoolYearFrom' => 2027, 'schoolYearTo' => 2028, 'semester' => 2,
        ])->assertCreated();

        $this->postJson('/api/applications', $this->applicationPayload())->assertCreated();

        $this->assertSame($current->id, Application::first()->membership_term_id);
    }

    private function applicationPayload(): array
    {
        return [
            'surname' => 'Santos', 'givenName' => 'Maria', 'middleInitial' => 'L',
            'yearLevel' => '3rd Year', 'section' => 'Section A', 'birthday' => '2004-05-05',
            'address' => '45 Mabini St', 'email' => 'maria@example.com', 'phone' => '09171234567',
            'signature' => UploadedFile::fake()->image('sig.png'),
            'picture' => UploadedFile::fake()->image('pic.jpg'),
        ];
    }
}
