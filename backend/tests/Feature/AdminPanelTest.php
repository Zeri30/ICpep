<?php

namespace Tests\Feature;

use App\Filament\Resources\ActivityLogResource;
use App\Filament\Resources\ApplicationResource;
use App\Filament\Widgets\MembersByClass;
use App\Filament\Widgets\RegistrationsOverTime;
use App\Filament\Widgets\StatsOverview;
use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'email' => env('ADMIN_EMAIL', 'admin@example.com'),
        ]);
    }

    private function makeApplication(array $overrides = []): Application
    {
        return Application::create(array_merge([
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

    /* ---------------------------------------------------------------- pages */

    public function test_dashboard_page_renders(): void
    {
        $this->actingAs($this->admin())
            ->get('/admin')
            ->assertOk()
            ->assertSee('Sign out');
    }

    public function test_stats_widget_shows_live_numbers_and_revenue(): void
    {
        $this->makeApplication(['year_level' => '3rd Year']);
        $this->makeApplication(['year_level' => '4th Year']);
        $this->actingAs($this->admin());

        // Revenue counts fees actually collected, so two unpaid members are ₱0.
        Livewire::test(StatsOverview::class)
            ->assertSee('Members')
            ->assertSee('Revenue collected')
            ->assertSee('₱0.00')
            ->assertSee('0 of 2 paid');
    }

    public function test_revenue_follows_who_has_paid(): void
    {
        $paid = $this->makeApplication(['year_level' => '3rd Year']);
        $this->makeApplication(['year_level' => '4th Year']);
        $this->actingAs($this->admin());

        $paid->update(['paid_at' => now()]);

        // 1 of 2 paid × ₱50 = ₱50.00 collected, ₱50 still pending.
        Livewire::test(StatsOverview::class)
            ->assertSee('₱50.00')
            ->assertSee('1 of 2 paid');

        // Reverting the payment takes the fee back out of the total.
        $paid->update(['paid_at' => null]);

        Livewire::test(StatsOverview::class)
            ->assertSee('₱0.00')
            ->assertSee('0 of 2 paid');
    }

    public function test_applications_list_renders(): void
    {
        Storage::fake('supabase');
        $this->makeApplication();

        $this->actingAs($this->admin())
            ->get(ApplicationResource::getUrl('index'))
            ->assertOk()
            ->assertSee('Dela Cruz');
    }

    public function test_application_view_page_renders(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $this->actingAs($this->admin())
            ->get(ApplicationResource::getUrl('view', ['record' => $application]))
            ->assertOk()
            ->assertSee('Dela Cruz');
    }

    public function test_member_edit_page_renders(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $this->actingAs($this->admin())
            ->get(ApplicationResource::getUrl('edit', ['record' => $application]))
            ->assertOk()
            ->assertSee('Dela Cruz');
    }

    public function test_activity_log_page_renders(): void
    {
        $this->actingAs($this->admin())
            ->get(ActivityLogResource::getUrl('index'))
            ->assertOk();
    }

    public function test_dashboard_chart_widgets_render(): void
    {
        $this->makeApplication();
        $this->actingAs($this->admin());

        Livewire::test(MembersByClass::class)->assertOk();
        Livewire::test(RegistrationsOverTime::class)->assertOk();
    }

    public function test_deleted_members_are_hidden_from_the_members_list_by_default(): void
    {
        Storage::fake('supabase');
        $active = $this->makeApplication(['surname' => 'Active']);
        $deleted = $this->makeApplication(['surname' => 'Removed']);
        $deleted->delete();

        // Soft-deleted members are kept in the DB but no longer shown by default.
        $this->actingAs($this->admin())
            ->get(ApplicationResource::getUrl('index'))
            ->assertOk()
            ->assertSee('Active')
            ->assertDontSee('Removed');

        $this->assertSoftDeleted('applications', ['id' => $deleted->id]);
    }

    public function test_deleted_member_can_be_restored(): void
    {
        Storage::fake('supabase');
        $member = $this->makeApplication(['surname' => 'Removed']);
        $member->delete();
        $this->assertSoftDeleted('applications', ['id' => $member->id]);

        // The "Undo delete" (restore) action brings the member back.
        $member->restore();

        $this->assertNotSoftDeleted('applications', ['id' => $member->id]);
        $this->assertSame(1, Application::count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'restored']);
    }

    /* ------------------------------------------------------- model behavior */

    public function test_creating_an_application_logs_a_registration(): void
    {
        $this->makeApplication();

        $this->assertDatabaseHas('activity_logs', ['action' => 'registered']);
    }

    public function test_editing_member_details_logs_an_update(): void
    {
        $application = $this->makeApplication();

        $application->update(['phone' => '09998887777']);

        $this->assertSame('09998887777', $application->fresh()->phone);
        $this->assertDatabaseHas('activity_logs', ['action' => 'updated']);
    }

    public function test_full_name_uses_last_first_middle_format(): void
    {
        $member = $this->makeApplication(['surname' => 'Dela Cruz', 'given_name' => 'Juan', 'middle_initial' => 'S']);
        $this->assertSame('Dela Cruz, Juan, S.', $member->full_name);

        $noMiddle = $this->makeApplication(['surname' => 'Reyes', 'given_name' => 'Ana', 'middle_initial' => null]);
        $this->assertSame('Reyes, Ana', $noMiddle->full_name);
    }

    public function test_class_code_accessor_combines_year_and_section(): void
    {
        $member = $this->makeApplication(['year_level' => '4th Year', 'section' => 'Section B']);

        $this->assertSame('4B', $member->class_code);
    }

    public function test_deleting_soft_deletes_and_logs(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $application->delete();

        // Kept in the DB (Deleted view), logged, and excluded from live counts.
        $this->assertSoftDeleted('applications', ['id' => $application->id]);
        $this->assertSame(1, Application::onlyTrashed()->count());
        $this->assertSame(0, Application::count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'deleted']);
    }

    public function test_restoring_logs_a_restore_not_an_update(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();
        $application->delete();

        $application->restore();

        $this->assertDatabaseHas('activity_logs', ['action' => 'restored']);
        // The restore() save() must not be mistaken for an admin edit.
        $this->assertDatabaseMissing('activity_logs', ['action' => 'updated']);
    }
}
