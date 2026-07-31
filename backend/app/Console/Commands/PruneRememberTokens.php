<?php

namespace App\Console\Commands;

use App\Models\RememberToken;
use Illuminate\Console\Command;

/** Deletes expired "remember me" tokens — they're already inert, this just keeps the table from growing forever. */
class PruneRememberTokens extends Command
{
    protected $signature = 'remember-tokens:prune';

    protected $description = 'Delete expired remember-me tokens';

    public function handle(): int
    {
        $deleted = RememberToken::where('expires_at', '<', now())->delete();

        $this->info("Deleted {$deleted} expired remember-me token(s).");

        return self::SUCCESS;
    }
}
