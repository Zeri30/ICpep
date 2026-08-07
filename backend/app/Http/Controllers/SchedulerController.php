<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Output\BufferedOutput;

/**
 * Stands in for a real crontab's `* * * * * php artisan schedule:run`.
 *
 * Render's free web-service tier has no timer of its own to run that line,
 * so the two Schedule::command() entries in routes/console.php
 * (App\Console\Commands\PruneRememberTokens / PruneActivityLogs) would
 * otherwise never fire. An external service (cron-job.org) hits this once a
 * day instead — see the `dailyAt()` + `timezone()` on both entries, which
 * has to line up with whatever exact minute that ping is configured for, or
 * `schedule:run` will find nothing due and do nothing.
 *
 * Unauthenticated by design, same reasoning as SharedEventController: the
 * caller has no officer session, so the long random SCHEDULER_TOKEN in the
 * URL is the only credential. Checked with hash_equals so response timing
 * can't be used to guess it, and a wrong or unset token 404s rather than
 * confirming the route exists to a scanner probing it blind.
 */
class SchedulerController extends Controller
{
    public function run(Request $request): JsonResponse
    {
        $expected = (string) config('icpep.scheduler_token');
        $given = (string) $request->query('token', '');

        if ($expected === '' || ! hash_equals($expected, $given)) {
            abort(404);
        }

        // Buffered rather than left to print to stdout — there is no console
        // attached to a web request for Artisan to write to.
        $output = new BufferedOutput();
        Artisan::call('schedule:run', [], $output);

        return response()->json([
            'ok' => true,
            'output' => trim($output->fetch()),
        ]);
    }
}
