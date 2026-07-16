<?php

namespace Tests\Feature;

use App\Models\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Application (member) model behaviour that the admin depends on but that lives
 * in the model, not the UI: derived accessors, and the activity-log events fired
 * on the record's lifecycle.
 */
class MemberModelTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_full_name_uses_last_first_middle_format(): void
    {
        $member = $this->makeApplication(['surname' => 'Dela Cruz', 'given_name' => 'Juan', 'middle_initial' => 'S']);
        $this->assertSame('Dela Cruz, Juan, S.', $member->full_name);

        $noMiddle = $this->makeApplication(['surname' => 'Reyes', 'given_name' => 'Ana', 'middle_initial' => null, 'email' => 'ana@example.com']);
        $this->assertSame('Reyes, Ana', $noMiddle->full_name);
    }

    public function test_class_code_accessor_combines_year_and_section(): void
    {
        $member = $this->makeApplication(['year_level' => '4th Year', 'section' => 'Section B']);

        $this->assertSame('4B', $member->class_code);
    }

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

    public function test_deleting_soft_deletes_and_logs(): void
    {
        Storage::fake('supabase');
        $application = $this->makeApplication();

        $application->delete();

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
