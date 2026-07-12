<?php

namespace Tests\Feature;

use App\Filament\Resources\ActivityLogResource;
use App\Filament\Resources\ApplicationResource;
use App\Filament\Widgets\RecentActivities;
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
            'status' => 'pending',
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

        // 2 registrations × ₱50 fee = ₱100.00 expected revenue.
        Livewire::test(StatsOverview::class)
            ->assertSee('Registrations (live)')
            ->assertSee('Expected revenue')
            ->assertSee('₱100.00');
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

    public function test_activity_log_page_renders(): void
    {
        $this->actingAs($this->admin())
            ->get(ActivityLogResource::getUrl('index'))
            ->assertOk();
    }

    public function test_recent_activities_widget_renders(): void
    {
        $this->makeApplication(); // creates a "registered" activity
        $this->actingAs($this->admin());

        Livewire::test(RecentActivities::class)
            ->assertOk()
            ->assertSee('Recent activity');
    }

    /* ------------------------------------------------------- model behavior */

    public function test_creating_an_application_logs_a_registration(): void
    {
        $this->makeApplication();

        $this->assertDatabaseHas('activity_logs', ['action' => 'registered']);
    }

    public function test_approving_updates_status_and_logs_activity(): void
    {
        $application = $this->makeApplication();

        $application->update(['status' => 'approved']);

        $this->assertSame('approved', $application->fresh()->status);
        $this->assertDatabaseHas('activity_logs', ['action' => 'approved']);
    }

    public function test_deleting_soft_deletes_and_logs(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $application->delete();

        // Kept in the DB (Deleted tab), logged, and excluded from live counts.
        $this->assertSoftDeleted('applications', ['id' => $application->id]);
        $this->assertSame(1, Application::onlyTrashed()->count());
        $this->assertSame(0, Application::count());
        $this->assertDatabaseHas('activity_logs', ['action' => 'deleted']);
    }

    public function test_force_delete_removes_record_and_logs(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $application->forceDelete();

        $this->assertDatabaseMissing('applications', ['id' => $application->id]);
        $this->assertDatabaseHas('activity_logs', ['action' => 'force_deleted']);
    }
}
