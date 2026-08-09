<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The external cron ping standing in for a real crontab — see
 * SchedulerController. Only the token check is this app's own responsibility
 * to get right; whether the two prune commands themselves run correctly is
 * covered where they're actually tested.
 */
class SchedulerControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_right_token_runs_the_scheduler(): void
    {
        config(['icpep.scheduler_token' => 'the-real-secret']);

        $this->postJson('/api/scheduler/run?token=the-real-secret')
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_a_wrong_token_is_refused(): void
    {
        config(['icpep.scheduler_token' => 'the-real-secret']);

        $this->postJson('/api/scheduler/run?token=guessed')
            ->assertNotFound();
    }

    public function test_no_token_at_all_is_refused(): void
    {
        config(['icpep.scheduler_token' => 'the-real-secret']);

        $this->postJson('/api/scheduler/run')
            ->assertNotFound();
    }

    /** An unset token must refuse everything, not accept an empty one back. */
    public function test_an_unconfigured_token_refuses_even_an_empty_guess(): void
    {
        config(['icpep.scheduler_token' => '']);

        $this->postJson('/api/scheduler/run?token=')
            ->assertNotFound();
    }
}
