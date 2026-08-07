<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Pinned to a fixed time in the org's own timezone, rather than the bare
// `->daily()` default (which runs at app-timezone midnight — UTC here, see
// config/app.php): `schedule:run` only runs a command when the *current*
// minute matches its schedule, and on Render's free tier nothing calls
// schedule:run except a once-a-day external ping (see SchedulerController).
// That ping has to be configured for this exact minute, in this exact
// timezone, or it fires a minute either side of when these are due and
// misses them entirely for the day.
Schedule::command('remember-tokens:prune')->dailyAt('03:00')->timezone(config('icpep.timezone'));
Schedule::command('activity-log:prune')->dailyAt('03:00')->timezone(config('icpep.timezone'));
