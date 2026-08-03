<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The JSON admin API that backs the React admin. Auth is the session `web`
 * guard restricted to the configured ADMIN_EMAIL (EnsureAdmin).
 */
class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    /** The bootstrap Programming Team account (full non-financial + user mgmt). */
    private function admin(): User
    {
        return User::factory()->programmingTeam()->create(['email' => env('ADMIN_EMAIL', 'admin@example.com')]);
    }

    /** A Treasurer — the role that may touch payments and financial modules. */
    private function treasurer(): User
    {
        return User::factory()->treasurer()->create();
    }

    /**
     * A member of the current membership list — which is where the public form
     * files everyone, and what the admin modules show by default. Tests that
     * care about a specific semester pass membership_term_id explicitly.
     */
    private function makeApplication(array $overrides = []): Application
    {
        return Application::create(array_merge([
            'membership_term_id' => MembershipTerm::current()?->id,
            'surname' => 'Dela Cruz',
            'given_name' => 'Juan',
            'middle_initial' => 'S',
            'year_level' => '3rd Year',
            'section' => 'Section A',
            'birthday' => '2004-01-01',
            'address' => '123 Rizal St',
            'email' => 'juan@example.com',
            'phone' => '09123456789',
            'signature_path' => 'signatures/x.png',
            'picture_path' => 'pictures/x.png',
        ], $overrides));
    }

    /* ------------------------------------------------------------------ auth */

    public function test_admin_api_requires_authentication(): void
    {
        $this->getJson('/api/admin/me')->assertUnauthorized();
        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
        $this->getJson('/api/admin/members')->assertUnauthorized();
    }

    public function test_deactivated_account_is_forbidden(): void
    {
        $deactivated = User::factory()->inactive()->create(['email' => 'someone-else@example.com']);

        // `reason` is what tells the React admin's SessionEndedModal to show
        // itself for this 403 specifically, rather than every permission
        // denial — see lib/adminApi.ts's parse().
        $this->actingAs($deactivated)->getJson('/api/admin/me')
            ->assertForbidden()
            ->assertJson(['reason' => 'account_deactivated']);
    }

    public function test_me_returns_officer_and_meta(): void
    {
        // Pinned rather than left to whatever MEMBERSHIP_FEE_1/2 happens to be
        // in .env — see test_dashboard_numbers_match_the_data for why.
        config(['icpep.membership_fee_1' => 50, 'icpep.membership_fee_2' => 25]);

        $this->actingAs($this->admin())
            ->getJson('/api/admin/me')
            ->assertOk()
            ->assertJsonPath('user.email', env('ADMIN_EMAIL', 'admin@example.com'))
            ->assertJsonPath('meta.feePayment1', 50)
            ->assertJsonPath('meta.feePayment2', 25)
            ->assertJsonPath('meta.currency', '₱')
            ->assertJsonPath('meta.classOptions', ['3A', '3B', '4A', '4B']);
    }

    public function test_login_returns_the_react_admin_url(): void
    {
        $admin = $this->admin();
        $admin->forceFill(['password' => bcrypt('secret1234')])->save();

        $this->postJson('/auth/admin/login', ['email' => $admin->email, 'password' => 'secret1234'])
            ->assertOk()
            ->assertJsonPath('redirect', rtrim(config('app.frontend_url'), '/').'/admin');
    }

    public function test_logout_clears_the_session_and_returns_landing(): void
    {
        $this->actingAs($this->admin())
            ->postJson('/auth/admin/logout')
            ->assertOk()
            ->assertJsonPath('redirect', config('app.frontend_url'));

        $this->assertGuest();
    }

    /* -------------------------------------------------- manage sessions */

    public function test_logout_other_sessions_requires_authentication(): void
    {
        $this->postJson('/api/admin/me/sessions/logout-others')->assertUnauthorized();
    }

    public function test_logout_other_sessions_clears_this_accounts_other_devices(): void
    {
        $admin = $this->admin();

        DB::table('sessions')->insert([
            ['id' => 'device-a', 'user_id' => $admin->id, 'payload' => 'x', 'last_activity' => time()],
            ['id' => 'device-b', 'user_id' => $admin->id, 'payload' => 'y', 'last_activity' => time()],
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/me/sessions/logout-others')
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
    }

    public function test_logout_all_sessions_signs_this_device_out_too(): void
    {
        $admin = $this->admin();

        DB::table('sessions')->insert([
            ['id' => 'device-a', 'user_id' => $admin->id, 'payload' => 'x', 'last_activity' => time()],
        ]);

        $this->actingAs($admin)
            ->postJson('/api/admin/me/sessions/logout-all')
            ->assertOk()
            ->assertJsonPath('redirect', config('app.frontend_url'));

        $this->assertSame(0, DB::table('sessions')->where('user_id', $admin->id)->count());
        $this->assertGuest();
    }

    /* ------------------------------------------------------------- dashboard */

    public function test_dashboard_numbers_match_the_data(): void
    {
        // Pinned rather than left to whatever MEMBERSHIP_FEE_1/2 happens to be
        // in .env — that's real config for the live site's actual fee, not a
        // fixture this assertion should be coupled to.
        config(['icpep.membership_fee_1' => 50, 'icpep.membership_fee_2' => 25]);

        $this->makeApplication(['year_level' => '3rd Year', 'paid_at' => now(), 'payment2_paid_at' => now()]);
        $this->makeApplication(['email' => 'b@example.com', 'year_level' => '4th Year']);

        // Revenue is only returned to finance roles.
        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('stats.members', 2)
            ->assertJsonPath('stats.thirdYear', 1)
            ->assertJsonPath('stats.fourthYear', 1)
            ->assertJsonPath('stats.paid', 1)
            // One member fully paid (50+25), one paying nothing yet: 75
            // collected, 75 still outstanding on the other.
            ->assertJsonPath('stats.revenue', 75)
            ->assertJsonPath('stats.pendingRevenue', 75)
            ->assertJsonCount(4, 'membersByClass.data')
            ->assertJsonCount(6, 'registrationsOverTime.data');
    }

    /* --------------------------------------------------------------- members */

    public function test_members_list_filters_by_class_and_payment(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['surname' => 'ThreeA', 'email' => '3a@example.com', 'year_level' => '3rd Year', 'section' => 'Section A', 'paid_at' => now()]);
        $this->makeApplication(['surname' => 'ThreeB', 'email' => '3b@example.com', 'year_level' => '3rd Year', 'section' => 'Section B']);
        $this->makeApplication(['surname' => 'FourA', 'email' => '4a@example.com', 'year_level' => '4th Year', 'section' => 'Section A']);

        $admin = $this->admin();

        // Year & Section filter.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?class=3A')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.classCode', '3A');

        // Payment filter.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?payment=p1_unpaid')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Year filter — independent of section, unlike the combined class code.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?year=3rd+Year')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_members_list_searches_and_excludes_trashed_by_default(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['surname' => 'Findable', 'email' => 'find@example.com']);
        $removed = $this->makeApplication(['surname' => 'Removed', 'email' => 'gone@example.com']);
        $removed->delete();

        $admin = $this->admin();

        $this->actingAs($admin)
            ->getJson('/api/admin/members?search=Findable')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Soft-deleted hidden by default, visible under the "only" trashed scope.
        $this->actingAs($admin)->getJson('/api/admin/members')->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/admin/members?trashed=only')->assertJsonCount(1, 'data');
    }

    public function test_deleted_members_filter_expires_after_the_retention_window(): void
    {
        Storage::fake('supabase');
        $recentlyDeleted = $this->makeApplication(['surname' => 'RecentlyDeleted', 'email' => 'recent@example.com']);
        $recentlyDeleted->delete();
        $recentlyDeleted->forceFill(['deleted_at' => now()->subDays(10)])->saveQuietly();

        $longDeleted = $this->makeApplication(['surname' => 'LongDeleted', 'email' => 'long@example.com']);
        $longDeleted->delete();
        $longDeleted->forceFill(['deleted_at' => now()->subDays(31)])->saveQuietly();

        $admin = $this->admin();

        // Within the 30-day window: shows up under "Deleted members". Past the
        // window, it's excluded from the filter too — but the row itself is
        // untouched in the database (soft delete only, no purge).
        $this->actingAs($admin)
            ->getJson('/api/admin/members?trashed=only')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.surname', 'RecentlyDeleted');

        $this->assertDatabaseHas('applications', ['id' => $longDeleted->id]);
    }

    public function test_members_list_search_matches_student_id_phone_and_section(): void
    {
        Storage::fake('supabase');
        $this->makeApplication([
            'surname' => 'Dela Cruz', 'given_name' => 'Juan', 'email' => 'delacruz@example.com',
            'student_id' => '2024-00123', 'phone' => '09171234567', 'section' => 'Section A',
        ]);
        $this->makeApplication([
            'surname' => 'Reyes', 'given_name' => 'Maria', 'email' => 'reyes@example.com',
            'student_id' => '2021-00456', 'phone' => '09209876543', 'section' => 'Section B',
        ]);

        $admin = $this->admin();

        // Partial + case-insensitive match on each of the new fields.
        $this->actingAs($admin)->getJson('/api/admin/members?search=2024')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.studentId', '2024-00123');
        $this->actingAs($admin)->getJson('/api/admin/members?search=juan')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.givenName', 'Juan');
        $this->actingAs($admin)->getJson('/api/admin/members?search=0917')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.phone', '09171234567');
        $this->actingAs($admin)->getJson('/api/admin/members?search='.urlencode('  Section B  '))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.section', 'Section B');

        // Combined with an existing filter: only rows matching both survive.
        $this->actingAs($admin)
            ->getJson('/api/admin/members?search=2024&class=3B')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    public function test_members_export_csv_respects_filters_and_search(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['surname' => 'ThreeA', 'given_name' => 'Juan', 'student_id' => '2024-001', 'year_level' => '3rd Year', 'section' => 'Section A', 'email' => 'threea@example.com']);
        $this->makeApplication(['surname' => 'ThreeB', 'given_name' => 'Maria', 'student_id' => '2024-002', 'year_level' => '3rd Year', 'section' => 'Section B', 'email' => 'threeb@example.com']);

        $response = $this->actingAs($this->admin())
            ->get('/api/admin/members/export/csv?class=3A')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $rows = array_map('str_getcsv', array_filter(explode("\n", trim($response->streamedContent()))));

        $this->assertSame(
            [
                'Student ID', 'Full Name', 'Year Level', 'Section', 'Phone', 'Email',
                'Payment 1 Status', 'Payment 1 Paid At', 'Payment 2 Status', 'Payment 2 Paid At', 'Registered At',
            ],
            $rows[0],
        );
        $this->assertCount(2, $rows); // header + the one 3A row — the 3B member is excluded.
        $this->assertSame('2024-001', $rows[1][0]);
    }

    public function test_members_export_excel_returns_xlsx_file(): void
    {
        Storage::fake('supabase');
        $this->makeApplication();

        $this->actingAs($this->admin())
            ->get('/api/admin/members/export/excel')
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->assertHeader('content-disposition');
    }

    public function test_members_export_pdf_includes_applied_filters(): void
    {
        Storage::fake('supabase');
        $this->makeApplication(['paid_at' => now()]);

        $response = $this->actingAs($this->admin())
            ->get('/api/admin/members/export/pdf?payment=p1_paid&search=Dela')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        // dompdf's stream() writes the PDF body straight to the response content.
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_members_export_requires_authentication(): void
    {
        $this->get('/api/admin/members/export/csv')->assertUnauthorized();
    }

    public function test_member_show_includes_signed_file_urls(): void
    {
        Storage::fake('supabase');
        $member = $this->makeApplication();

        $this->actingAs($this->admin())
            ->getJson("/api/admin/members/{$member->id}")
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Dela Cruz, Juan, S.')
            ->assertJsonStructure(['data' => ['pictureUrl', 'signatureUrl']]);
    }

    /* ---------------------------------------------------- payments & activity */

    public function test_payments_ledger_lists_and_filters(): void
    {
        // Pinned rather than left to whatever MEMBERSHIP_FEE_1 happens to be
        // in .env — see test_dashboard_numbers_match_the_data for why.
        config(['icpep.membership_fee_1' => 50]);

        // Marking paid writes a 'paid' ledger row via the model event.
        $this->makeApplication(['section' => 'Section A'])->update(['paid_at' => now()]);

        // Payment History is a financial module — Treasurer roles only.
        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?action=paid')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.action', 'paid')
            ->assertJsonPath('data.0.kind', 'payment1')
            ->assertJsonPath('data.0.amount', 50);
    }

    public function test_payments_ledger_filters_by_payment_batch(): void
    {
        config(['icpep.membership_fee_1' => 50, 'icpep.membership_fee_2' => 25]);

        $this->makeApplication(['email' => 'batch@example.com'])->update(['paid_at' => now(), 'payment2_paid_at' => now()]);

        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?kind=payment1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kind', 'payment1')
            ->assertJsonPath('data.0.amount', 50);

        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?kind=payment2')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kind', 'payment2')
            ->assertJsonPath('data.0.amount', 25);
    }

    public function test_payments_ledger_tags_each_row_with_its_semester(): void
    {
        $current = MembershipTerm::current();
        $past = MembershipTerm::factory()->term(2027, 1)->create(); // not current

        $this->makeApplication(['email' => 'a@example.com', 'membership_term_id' => $current?->id])->update(['paid_at' => now()]);
        $this->makeApplication(['email' => 'b@example.com', 'membership_term_id' => $past->id])->update(['paid_at' => now()]);

        $rows = $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?term='.$current?->id)
            ->assertOk()
            ->json('data');
        $this->assertTrue(collect($rows)->first()['paymentTerm']['isCurrent']);

        $rows = $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?term='.$past->id)
            ->assertOk()
            ->json('data');
        $this->assertFalse(collect($rows)->first()['paymentTerm']['isCurrent']);
        $this->assertSame('27-28, Sem 1', collect($rows)->first()['paymentTerm']['shortLabel']);
    }

    public function test_payments_ledger_filters_by_combined_year_and_section(): void
    {
        $this->makeApplication(['email' => 'a@example.com', 'year_level' => '3rd Year', 'section' => 'Section A'])->update(['paid_at' => now()]);
        $this->makeApplication(['email' => 'b@example.com', 'year_level' => '3rd Year', 'section' => 'Section B'])->update(['paid_at' => now()]);
        $this->makeApplication(['email' => 'c@example.com', 'year_level' => '4th Year', 'section' => 'Section A'])->update(['paid_at' => now()]);

        $this->actingAs($this->treasurer())
            ->getJson('/api/admin/payments?class=3A')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.yearLevel', '3rd Year')
            ->assertJsonPath('data.0.section', 'Section A');
    }

    public function test_activity_log_lists_and_filters_by_action(): void
    {
        $this->makeApplication(); // logs a 'registered' entry

        $this->actingAs($this->admin())
            ->getJson('/api/admin/activity?action=registered')
            ->assertOk()
            ->assertJsonPath('data.0.action', 'registered');
    }

    /* ---------------------------------------------------------- member writes */

    public function test_toggle_paid_flips_state_and_records_a_payment_transaction(): void
    {
        $member = $this->makeApplication();
        $admin = $this->treasurer();

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/toggle-paid", ['batch' => 1])->assertOk();
        $this->assertNotNull($member->fresh()->paid_at);
        $this->assertDatabaseHas('payment_transactions', ['application_id' => $member->id, 'action' => 'paid', 'kind' => 'payment1']);
        // Payment History is the ledger for this — it isn't duplicated into
        // the Activity Log too.
        $this->assertDatabaseMissing('activity_logs', ['action' => 'paid']);

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/toggle-paid", ['batch' => 1])->assertOk();
        $this->assertNull($member->fresh()->paid_at);
    }

    public function test_update_edits_details_and_logs_an_update(): void
    {
        $member = $this->makeApplication();

        $this->actingAs($this->admin())
            ->patchJson("/api/admin/members/{$member->id}", [
                'surname' => 'Reyes',
                'givenName' => 'Ana',
                'middleInitial' => null,
                'studentId' => '1234567890',
                'yearLevel' => '4th Year',
                'section' => 'Section B',
                'birthday' => '2003-05-05',
                'address' => '9 New St',
                'email' => 'ana@example.com',
                'phone' => '09990001111',
                'paidAt' => null,
            ])
            ->assertOk()
            ->assertJsonPath('data.fullName', 'Reyes, Ana');

        $this->assertDatabaseHas('activity_logs', ['action' => 'updated']);
    }

    public function test_delete_soft_deletes_and_restore_brings_back(): void
    {
        $member = $this->makeApplication();
        $admin = $this->admin();

        $this->actingAs($admin)->deleteJson("/api/admin/members/{$member->id}")->assertOk();
        $this->assertSoftDeleted('applications', ['id' => $member->id]);

        $this->actingAs($admin)->postJson("/api/admin/members/{$member->id}/restore")->assertOk();
        $this->assertNotSoftDeleted('applications', ['id' => $member->id]);
    }

    public function test_bulk_mark_paid_preserves_existing_dates(): void
    {
        $unpaid = $this->makeApplication(['email' => 'u@example.com']);
        $paid = $this->makeApplication(['email' => 'p@example.com', 'paid_at' => now()->subDays(5)]);

        $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$unpaid->id, $paid->id], 'action' => 'payment1_paid'])
            ->assertOk()
            // `count` is the ids considered, not the rows changed — the admin
            // reports its own figure for what actually moved.
            ->assertJsonPath('count', 2);

        $this->assertNotNull($unpaid->fresh()->paid_at);
        // Already paid: the original date stands, and no second fee is recorded.
        $this->assertTrue($paid->fresh()->paid_at->isSameDay(now()->subDays(5)));
        $this->assertSame(0, $paid->paymentTransactions()->count());
    }

    public function test_bulk_mark_paid_writes_the_ledger_in_bulk_and_reports_updates(): void
    {
        config(['icpep.membership_fee_1' => 50]);

        $a = $this->makeApplication(['email' => 'a@example.com', 'surname' => 'Alpha']);
        $b = $this->makeApplication(['email' => 'b@example.com', 'surname' => 'Bravo']);

        $response = $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$a->id, $b->id], 'action' => 'payment1_paid'])
            ->assertOk()
            ->assertJsonPath('count', 2)
            ->assertJsonCount(2, 'updated');

        $updated = collect($response->json('updated'))->keyBy('id');
        $this->assertTrue($updated[$a->id]['isPayment1Paid']);
        $this->assertNotNull($updated[$a->id]['payment1PaidAt']);
        $this->assertFalse($updated[$a->id]['isPayment2Paid']);

        // One ledger row per member — written as one bulk insert rather than
        // one round trip per member. Payment History is the ledger for this;
        // it isn't also duplicated into the Activity Log.
        $this->assertSame(1, $a->paymentTransactions()->where('action', PaymentTransaction::PAID)->count());
        $this->assertSame(1, $b->paymentTransactions()->where('action', PaymentTransaction::PAID)->count());
        $this->assertSame(50.0, (float) $a->paymentTransactions()->sole()->amount);
        $this->assertSame(PaymentTransaction::PAYMENT_1, $a->paymentTransactions()->sole()->kind);
        $this->assertSame(0, ActivityLog::where('action', 'paid')->count());
    }

    public function test_bulk_mark_unpaid_reverses_against_the_original_date(): void
    {
        $paidOn = now()->subDays(5);
        $member = $this->makeApplication(['email' => 'c@example.com', 'paid_at' => $paidOn]);
        $member->paymentTransactions()->delete(); // isolate this test's own ledger row

        $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$member->id], 'action' => 'payment1_unpaid'])
            ->assertOk()
            ->assertJsonPath('updated.0.isPayment1Paid', false)
            ->assertJsonPath('updated.0.payment1PaidAt', null);

        $tx = $member->paymentTransactions()->sole();
        $this->assertSame(PaymentTransaction::REVOKED, $tx->action);
        // The reversal is stamped against the original payment date, not today.
        $this->assertTrue($tx->effective_at->isSameDay($paidOn));
        $this->assertNull($member->fresh()->paid_at);
    }

    public function test_bulk_payment2_paid_requires_payment1_paid(): void
    {
        $notEligible = $this->makeApplication(['email' => 'n@example.com']); // Payment 1 unpaid
        $eligible = $this->makeApplication(['email' => 'e@example.com', 'paid_at' => now()]);

        $response = $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$notEligible->id, $eligible->id], 'action' => 'payment2_paid'])
            ->assertOk()
            ->assertJsonPath('count', 2)
            // Only the eligible member is reported changed — the other is
            // silently skipped, not errored, same as an already-paid member is.
            ->assertJsonCount(1, 'updated');

        $this->assertSame($eligible->id, $response->json('updated.0.id'));
        $this->assertNull($notEligible->fresh()->payment2_paid_at);
        $this->assertNotNull($eligible->fresh()->payment2_paid_at);
    }

    public function test_bulk_payment1_unpaid_is_blocked_while_payment2_is_paid(): void
    {
        $bothPaid = $this->makeApplication(['email' => 'both@example.com', 'paid_at' => now(), 'payment2_paid_at' => now()]);

        $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$bothPaid->id], 'action' => 'payment1_unpaid'])
            ->assertOk()
            ->assertJsonCount(0, 'updated');

        $this->assertNotNull($bothPaid->fresh()->paid_at);
    }

    public function test_bulk_both_paid_pays_payment1_first_then_payment2(): void
    {
        config(['icpep.membership_fee_1' => 50, 'icpep.membership_fee_2' => 25]);

        $untouched = $this->makeApplication(['email' => 'untouched@example.com']);
        $partial = $this->makeApplication(['email' => 'partial@example.com', 'paid_at' => now()->subDays(3)]);

        $response = $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$untouched->id, $partial->id], 'action' => 'both_paid'])
            ->assertOk()
            ->assertJsonCount(2, 'updated');

        $updated = collect($response->json('updated'))->keyBy('id');
        $this->assertTrue($updated[$untouched->id]['isPayment1Paid']);
        $this->assertTrue($updated[$untouched->id]['isPayment2Paid']);
        $this->assertTrue($updated[$partial->id]['isPayment2Paid']);

        // The already-paid member's Payment 1 date is untouched; only
        // Payment 2 is newly written for them.
        $this->assertTrue($partial->fresh()->paid_at->isSameDay(now()->subDays(3)));
        $this->assertSame(1, $partial->paymentTransactions()->count());
        $this->assertSame(2, $untouched->paymentTransactions()->count());
    }

    public function test_bulk_both_unpaid_reverses_both_payments(): void
    {
        $member = $this->makeApplication(['email' => 'both2@example.com', 'paid_at' => now(), 'payment2_paid_at' => now()]);
        $member->paymentTransactions()->delete();

        $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/bulk', ['ids' => [$member->id], 'action' => 'both_unpaid'])
            ->assertOk()
            ->assertJsonPath('updated.0.isPayment1Paid', false)
            ->assertJsonPath('updated.0.isPayment2Paid', false);

        $this->assertNull($member->fresh()->paid_at);
        $this->assertNull($member->fresh()->payment2_paid_at);
        $this->assertSame(2, $member->paymentTransactions()->where('action', PaymentTransaction::REVOKED)->count());
    }

    public function test_bulk_delete_and_restore_report_no_row_patch(): void
    {
        $member = $this->makeApplication(['email' => 'd@example.com']);
        $admin = $this->admin();

        // delete/restore change which page a row belongs on, so the client
        // still needs a real refetch for these — `updated` stays empty.
        $this->actingAs($admin)
            ->postJson('/api/admin/members/bulk', ['ids' => [$member->id], 'action' => 'delete'])
            ->assertOk()
            ->assertJsonPath('count', 1)
            ->assertJsonPath('updated', []);
        $this->assertSoftDeleted('applications', ['id' => $member->id]);

        $this->actingAs($admin)
            ->postJson('/api/admin/members/bulk', ['ids' => [$member->id], 'action' => 'restore'])
            ->assertOk()
            ->assertJsonPath('updated', []);
        $this->assertNotSoftDeleted('applications', ['id' => $member->id]);
    }

    /**
     * Payments are only ever applied to an explicit set of ids. The endpoint
     * that swept every member matching the current filters is gone — a single
     * click should not be able to rewrite a semester's payment records.
     */
    public function test_there_is_no_endpoint_that_pays_the_whole_filtered_set(): void
    {
        $this->makeApplication(['email' => 'a@example.com']);

        $response = $this->actingAs($this->treasurer())
            ->postJson('/api/admin/members/mark-all-paid', ['class' => '3A']);

        // Rejected — 405 rather than 404, since /members/{application} still
        // answers PATCH and DELETE on that path. What matters is the outcome:
        // no request pays a member the caller did not name.
        $this->assertGreaterThanOrEqual(400, $response->status());
        $this->assertSame(0, Application::whereNotNull('paid_at')->count());
    }
}
