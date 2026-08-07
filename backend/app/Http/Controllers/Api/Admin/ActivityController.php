<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only activity history. Filter by action (registered / updated / deleted /
 * restored / login) and search over the description and actor, mirroring the
 * Filament resource.
 *
 * Payment events (paid/unpaid) are deliberately not among these — that ledger
 * lives in Payment History (payment_transactions) only, not here too.
 */
class ActivityController extends Controller
{
    private const ACTIONS = [
        'registered', 'updated', 'deleted', 'restored', 'login', 'login_failed', 'logout',
        // User Management.
        'user_created', 'user_updated', 'user_activated', 'user_deactivated', 'user_deleted', 'password_reset',
        'users_logged_out_all',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        // Historical rows from before payments moved to their own ledger, plus
        // whichever rows this viewer's role shouldn't see at all (always the
        // "remember me" cookie internals, and sign-in/account-lifecycle events
        // for every role but the Programming Team) — excluded outright rather
        // than left reachable only by bypassing the dropdown, since the whole
        // point is that they no longer belong in this viewer's log.
        $hidden = ['paid', 'unpaid', ...ActivityLog::hiddenActionsFor($request->user())];
        $query = ActivityLog::query()->whereNotIn('action', $hidden)->latest();

        if (($action = $request->query('action')) && in_array($action, self::ACTIONS, true)) {
            $query->where('action', $action);
        }

        // Leading-wildcard LIKE — same tradeoff as PaymentController::filtered's
        // search, and deliberately left as a plain LIKE for the same reason:
        // no B-tree index can serve it, so this is a sequential scan by
        // design, and at this org's scale (a few hundred rows per term, and
        // now bounded from growing unboundedly by the scheduled prune — see
        // icpep.activity_log_retention_days and PruneActivityLogs) that scan
        // costs a fraction of a millisecond. Not worth a pg_trgm GIN index
        // and its write-time/storage cost until there's an actual reason to
        // pay it.
        //
        // Revisit if the row count climbs into the low thousands or a search
        // is ever *measured* slow: add `CREATE EXTENSION IF NOT EXISTS
        // pg_trgm;` plus `CREATE INDEX ... USING gin (column gin_trgm_ops)`
        // on description/actor_name/actor, then swap these LIKEs for
        // `whereRaw('column ILIKE ?', ...)` (trigram indexes need ILIKE/LIKE
        // via raw SQL to be picked up on Postgres, not Eloquent's portable
        // 'like' operator).
        if ($search = trim((string) $request->query('search'))) {
            $query->where(function (Builder $q) use ($search): void {
                $q->where('description', 'like', "%{$search}%")
                    // The name is what the table shows, so it has to be what
                    // the search matches; email stays searchable behind it.
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('actor', 'like', "%{$search}%");
            });
        }

        // Inclusive range over `created_at` — the only date an activity row
        // has. The frontend's Today/Last 7 days/Last 30 days presets just
        // fill in these same two fields, so there is one code path here
        // whether the range came from a preset or the date pickers directly.
        $query
            ->when($request->query('from'), fn (Builder $q, $d): Builder => $q->whereDate('created_at', '>=', $d))
            ->when($request->query('until'), fn (Builder $q, $d): Builder => $q->whereDate('created_at', '<=', $d));

        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        return ActivityLogResource::collection($query->paginate($perPage)->withQueryString());
    }
}
