<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\ModuleView;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * The dashboard's four widgets in one payload: headline stats, the
 * today/week/month payment summary, and the two charts.
 *
 * Everything is scoped to one semester's membership list — the current one
 * unless a `term` is named — so the figures describe the same roster the
 * Members module is showing rather than every semester ever recorded.
 */
class DashboardController extends Controller
{
    /**
     * How long the underlying numbers (headlineAggregates, membersByClass,
     * registrationsOverTime) are cached before a request re-queries them.
     * Short on purpose: this is the app's most-visited page, opened and
     * re-opened all day, and the figures only need to be "close enough" —
     * unlike Payment History's list, nobody is reading these three widgets
     * row-by-row against the ledger, so a brief lag between a payment
     * landing and the dashboard reflecting it is an acceptable trade for
     * not re-running the same aggregates on every visit.
     */
    private const CACHE_TTL_SECONDS = 45;

    public function index(Request $request): JsonResponse
    {
        // Money figures (revenue and the payment summary) are only returned to
        // roles that may see the chapter's takings; everyone else gets the
        // membership counts and charts. The frontend hides the same cards.
        //
        // Gated on finance.revenue, not finance.view: reading Payment History
        // and seeing the revenue are separate abilities, so a role can keep the
        // records without being shown the income (see Permission::ViewRevenue).
        $canRevenue = Gate::allows('finance.revenue');
        $term = MembershipTerm::resolve($request->query('term'));

        // Cached, but only the raw numbers — never this permission check or
        // the response shape it produces. That's deliberate: caching the
        // gated response would risk one officer's request serving a
        // different officer's revenue visibility for the next ~45 seconds.
        // Instead every request evaluates $canRevenue and builds stats()/
        // paymentSummary() itself, live, whether the underlying data came
        // from cache or not — so permissions are exactly as fresh as they
        // are without this cache.
        [$headline, $membersByClass, $registrationsOverTime] = $this->cachedData($term);

        return response()->json([
            'stats' => $this->stats($canRevenue, $headline),
            'paymentSummary' => $canRevenue ? $this->paymentSummary($headline) : null,
            'membersByClass' => $membersByClass,
            'registrationsOverTime' => $registrationsOverTime,
            'canViewRevenue' => $canRevenue,
            'term' => $term ? ['id' => $term->id, 'label' => $term->label, 'isCurrent' => $term->is_current] : null,
        ]);
    }

    /**
     * The three query results index() needs, one round trip on a cache miss
     * and zero on a hit — scoped per term, since that's the only thing any
     * of the three vary by. All plain arrays of scalars (no Eloquent models),
     * so they cache cleanly on every driver this app uses.
     *
     * @return array{0: array<string, int>, 1: array<string, mixed>, 2: array<string, mixed>}
     */
    private function cachedData(?MembershipTerm $term): array
    {
        return Cache::remember(
            'dashboard.data.'.($term?->id ?? 'all'),
            now()->addSeconds(self::CACHE_TTL_SECONDS),
            fn (): array => [
                $this->headlineAggregates($term),
                $this->membersByClass($term),
                $this->registrationsOverTime($term),
            ],
        );
    }

    /**
     * Unread counts for the sidebar nav badges — records created since this
     * officer last opened each module (see ModuleView), not the module's
     * total. An officer who has never opened a module sees everything in it
     * as unread, same as a first-time inbox.
     */
    public function counts(Request $request): JsonResponse
    {
        $term = MembershipTerm::resolve($request->query('term'));
        $lastViewed = ModuleView::lastViewedFor($request->user());

        $members = $this->members($term);
        if ($since = $lastViewed->get('members')) {
            $members->where('created_at', '>', $since);
        }

        $payments = PaymentTransaction::query();
        if ($term) {
            $payments->forTerm($term->id);
        }
        if ($since = $lastViewed->get('payments')) {
            $payments->where('created_at', '>', $since);
        }

        // Accounts are organization-wide, not per-semester.
        $users = User::query();
        if ($since = $lastViewed->get('users')) {
            $users->where('created_at', '>', $since);
        }

        // Not scoped to the term — the log itself isn't either. Excludes
        // whatever this officer's Activity Log itself hides (see
        // ActivityController), so the sidebar badge never advertises "new"
        // rows the module then doesn't actually show them.
        $activity = ActivityLog::query()->whereNotIn('action', ActivityLog::hiddenActionsFor($request->user()));
        if ($since = $lastViewed->get('activity')) {
            $activity->where('created_at', '>', $since);
        }

        return response()->json($this->countsInOneRoundTrip($members, $payments, $users, $activity));
    }

    /**
     * Four badge counts, one query: each filtered builder becomes a scalar
     * `(select count(*) from ...)` subquery of a single tableless SELECT,
     * rather than four separate COUNT round trips against the remote
     * pooler — this endpoint backs the sidebar badges, so it's plausibly
     * one of the most frequently hit routes in the admin.
     *
     * @param  Builder<Application>  $members
     * @param  Builder<PaymentTransaction>  $payments
     * @param  Builder<User>  $users
     * @param  Builder<ActivityLog>  $activity
     * @return array{members:int,payments:int,users:int,activity:int}
     */
    private function countsInOneRoundTrip(Builder $members, Builder $payments, Builder $users, Builder $activity): array
    {
        $row = DB::query()
            ->selectSub($members->toBase()->select(DB::raw('count(*)')), 'members')
            ->selectSub($payments->toBase()->select(DB::raw('count(*)')), 'payments')
            ->selectSub($users->toBase()->select(DB::raw('count(*)')), 'users')
            ->selectSub($activity->toBase()->select(DB::raw('count(*)')), 'activity')
            ->first();

        return [
            'members' => (int) $row->members,
            'payments' => (int) $row->payments,
            'users' => (int) $row->users,
            'activity' => (int) $row->activity,
        ];
    }

    /**
     * Members in the given term. The single place term scoping is applied, so a
     * widget cannot accidentally report across every semester.
     *
     * @return Builder<Application>
     */
    private function members(?MembershipTerm $term): Builder
    {
        $query = Application::query();

        return $term ? $query->forTerm($term->id) : $query;
    }

    /**
     * Every number stats() and paymentSummary() need, in one round trip: a
     * single row of conditional SUMs standing in for what used to be 4
     * separate count() calls for stats() plus 3 more for paymentSummary().
     *
     * SUM() over zero matching rows is NULL in both Postgres and SQLite (only
     * COUNT is guaranteed 0), so every field is cast through (int) rather
     * than trusting a bare column read — a term with no applications yet
     * would otherwise turn every figure into `null` instead of `0`.
     *
     * @return array{live:int,paid:int,paid2:int,bothPaid:int,thirdYear:int,fourthYear:int,paidToday:int,paidWeek:int,paidMonth:int,paid2Today:int,paid2Week:int,paid2Month:int}
     */
    private function headlineAggregates(?MembershipTerm $term): array
    {
        $today = [Carbon::today()->startOfDay(), Carbon::today()->endOfDay()];
        $week = [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()];
        $month = [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()];

        $row = $this->members($term)
            ->selectRaw('COUNT(*) as live')
            ->selectRaw('SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END) as paid')
            ->selectRaw('SUM(CASE WHEN payment2_paid_at IS NOT NULL THEN 1 ELSE 0 END) as paid2')
            // Both batches settled — what the "Paid members" headline card
            // shows, distinct from `paid`/`paid2` above (each batch's own
            // collected count, which `revenue` below still needs separately).
            ->selectRaw('SUM(CASE WHEN paid_at IS NOT NULL AND payment2_paid_at IS NOT NULL THEN 1 ELSE 0 END) as both_paid')
            ->selectRaw('SUM(CASE WHEN year_level = ? THEN 1 ELSE 0 END) as third_year', ['3rd Year'])
            ->selectRaw('SUM(CASE WHEN year_level = ? THEN 1 ELSE 0 END) as fourth_year', ['4th Year'])
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_today', $today)
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_week', $week)
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_month', $month)
            ->selectRaw('SUM(CASE WHEN payment2_paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid2_today', $today)
            ->selectRaw('SUM(CASE WHEN payment2_paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid2_week', $week)
            ->selectRaw('SUM(CASE WHEN payment2_paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid2_month', $month)
            ->first();

        return [
            'live' => (int) $row->live,
            'paid' => (int) $row->paid,
            'paid2' => (int) $row->paid2,
            'bothPaid' => (int) $row->both_paid,
            'thirdYear' => (int) $row->third_year,
            'fourthYear' => (int) $row->fourth_year,
            'paidToday' => (int) $row->paid_today,
            'paidWeek' => (int) $row->paid_week,
            'paidMonth' => (int) $row->paid_month,
            'paid2Today' => (int) $row->paid2_today,
            'paid2Week' => (int) $row->paid2_week,
            'paid2Month' => (int) $row->paid2_month,
        ];
    }

    /**
     * Members / 3rd / 4th / revenue — derived from current state, never
     * accumulated. `paid`/`unpaid` count members with *both* batches settled
     * — the membership isn't considered paid on Payment 1 alone. `revenue`
     * still sums each batch's own collected count (`paid`/`paid2` from the
     * aggregates, not the `bothPaid` figure this card uses) — someone who's
     * paid Payment 1 but not Payment 2 has still paid Payment 1, and that
     * ₱ has to keep showing up in revenue regardless of what the headline
     * card above calls them.
     */
    private function stats(bool $canRevenue, array $headline): array
    {
        $fee1 = (float) config('icpep.membership_fee_1');
        $fee2 = (float) config('icpep.membership_fee_2');
        $live = $headline['live'];
        $paid = $headline['paid'];
        $paid2 = $headline['paid2'];
        $bothPaid = $headline['bothPaid'];

        return [
            'members' => $live,
            'thirdYear' => $headline['thirdYear'],
            'fourthYear' => $headline['fourthYear'],
            'paid' => $bothPaid,
            'unpaid' => $live - $bothPaid,
            // Peso figures are the chapter's income — null them out for roles
            // that may read the ledger but not the takings.
            'revenue' => $canRevenue ? $paid * $fee1 + $paid2 * $fee2 : null,
            // Total possible (every live member paying both batches in full)
            // minus what's actually been collected — not "unpaid1 * fee1",
            // which would undercount a member who owes both batches in full.
            'pendingRevenue' => $canRevenue
                ? $live * ($fee1 + $fee2) - ($paid * $fee1 + $paid2 * $fee2)
                : null,
        ];
    }

    /** Fees collected today / this week / this month, from both payment columns. */
    private function paymentSummary(array $headline): array
    {
        $fee1 = (float) config('icpep.membership_fee_1');
        $fee2 = (float) config('icpep.membership_fee_2');

        $amount = fn (string $p1Key, string $p2Key): float => $headline[$p1Key] * $fee1 + $headline[$p2Key] * $fee2;

        return [
            'today' => ['members' => $headline['paidToday'], 'amount' => $amount('paidToday', 'paid2Today'), 'label' => Carbon::today()->format('M j, Y')],
            'week' => ['members' => $headline['paidWeek'], 'amount' => $amount('paidWeek', 'paid2Week'), 'label' => Carbon::now()->startOfWeek()->format('M j').' – '.Carbon::now()->endOfWeek()->format('M j')],
            'month' => ['members' => $headline['paidMonth'], 'amount' => $amount('paidMonth', 'paid2Month'), 'label' => Carbon::now()->format('F Y')],
        ];
    }

    /** Headcount per 3A/3B/4A/4B — one GROUP BY instead of one count() per class. */
    private function membersByClass(?MembershipTerm $term): array
    {
        $byGroup = $this->members($term)
            ->select('year_level', 'section')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('year_level', 'section')
            ->get()
            ->mapWithKeys(fn ($row): array => ["{$row->year_level}|{$row->section}" => (int) $row->total]);

        return [
            'labels' => array_keys(Application::CLASS_MAP),
            'data' => collect(Application::CLASS_MAP)
                ->map(fn (array $c): int => $byGroup->get("{$c[0]}|{$c[1]}", 0))
                ->values()
                ->all(),
        ];
    }

    /** New members per month over the last six months — one GROUP BY instead of one count() per month. */
    private function registrationsOverTime(?MembershipTerm $term): array
    {
        $months = collect(range(5, 0))->map(fn (int $i): Carbon => now()->startOfMonth()->subMonths($i));

        $byMonth = $this->members($term)
            ->where('created_at', '>=', $months->first())
            ->selectRaw($this->monthKeyExpression().' as ym')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('ym')
            ->pluck('total', 'ym');

        return [
            'labels' => $months->map(fn (Carbon $m): string => $m->format('M Y'))->all(),
            'data' => $months->map(fn (Carbon $m): int => (int) ($byMonth->get($m->format('Y-m')) ?? 0))->all(),
        ];
    }

    /**
     * "YYYY-MM" from `created_at`, in whichever SQL dialect the current
     * connection speaks — Postgres in production, SQLite in tests (see
     * phpunit.xml), and there is no driver-agnostic way to truncate a date
     * to the month in raw SQL.
     */
    private function monthKeyExpression(): string
    {
        return match (DB::connection()->getDriverName()) {
            'sqlite' => "strftime('%Y-%m', created_at)",
            default => "to_char(created_at, 'YYYY-MM')",
        };
    }
}
