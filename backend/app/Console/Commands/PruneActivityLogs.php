<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;

/**
 * Deletes Activity Log rows older than icpep.activity_log_retention_days —
 * the audit trail's equivalent of PruneRememberTokens, keeping the table
 * from growing forever now that nothing else bounds its size.
 *
 * Deletes in bounded batches rather than one `WHERE created_at < ?` statement,
 * so a large backlog (a first run against a table that's never been pruned
 * before, or a very inactive prune schedule catching up) doesn't hold a
 * single long-running transaction/lock against a table every admin action
 * writes to. Recent rows — everything inside the retention window — are
 * never touched, so the audit trail and Activity Log module behave exactly
 * as before for anything a user would actually look at.
 */
class PruneActivityLogs extends Command
{
    protected $signature = 'activity-log:prune';

    protected $description = 'Delete Activity Log rows older than the configured retention period';

    /** Rows removed per DELETE, so no single statement locks more than this many. */
    private const BATCH_SIZE = 1000;

    public function handle(): int
    {
        $cutoff = now()->subDays((int) config('icpep.activity_log_retention_days'));

        $deleted = 0;

        do {
            $ids = ActivityLog::where('created_at', '<', $cutoff)
                ->orderBy('id')
                ->limit(self::BATCH_SIZE)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted += ActivityLog::whereIn('id', $ids)->delete();
        } while ($ids->count() === self::BATCH_SIZE);

        $this->info("Deleted {$deleted} Activity Log row(s) older than {$cutoff->toDateString()}.");

        return self::SUCCESS;
    }
}
