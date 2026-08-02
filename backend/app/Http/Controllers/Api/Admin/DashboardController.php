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

        // One row of conditional aggregates covers stats() and (when the role
        // may see it) paymentSummary() together — 7 separate count() queries
        // collapse into this single round trip.
        $headline = $this->headlineAggregates($term);

        return response()->json([
            'stats' => $this->stats($canRevenue, $headline),
            'paymentSummary' => $canRevenue ? $this->paymentSummary($headline) : null,
            'membersByClass' => $this->membersByClass($term),
            'registrationsOverTime' => $this->registrationsOverTime($term),
            'canViewRevenue' => $canRevenue,
            'term' => $term ? ['id' => $term->id, 'label' => $term->label, 'isCurrent' => $term->is_current] : null,
        ]);
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

        // Not scoped to the term — the log itself isn't either.
        $activity = ActivityLog::query();
        if ($since = $lastViewed->get('activity')) {
            $activity->where('created_at', '>', $since);
        }

        return response()->json([
            'members' => $members->count(),
            'payments' => $payments->count(),
            'users' => $users->count(),
            'activity' => $activity->count(),
        ]);
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
     * @return array{live:int,paid:int,thirdYear:int,fourthYear:int,paidToday:int,paidWeek:int,paidMonth:int}
     */
    private function headlineAggregates(?MembershipTerm $term): array
    {
        $today = [Carbon::today()->startOfDay(), Carbon::today()->endOfDay()];
        $week = [Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek()];
        $month = [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()];

        $row = $this->members($term)
            ->selectRaw('COUNT(*) as live')
            ->selectRaw('SUM(CASE WHEN paid_at IS NOT NULL THEN 1 ELSE 0 END) as paid')
            ->selectRaw('SUM(CASE WHEN year_level = ? THEN 1 ELSE 0 END) as third_year', ['3rd Year'])
            ->selectRaw('SUM(CASE WHEN year_level = ? THEN 1 ELSE 0 END) as fourth_year', ['4th Year'])
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_today', $today)
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_week', $week)
            ->selectRaw('SUM(CASE WHEN paid_at BETWEEN ? AND ? THEN 1 ELSE 0 END) as paid_month', $month)
            ->first();

        return [
            'live' => (int) $row->live,
            'paid' => (int) $row->paid,
            'thirdYear' => (int) $row->third_year,
            'fourthYear' => (int) $row->fourth_year,
            'paidToday' => (int) $row->paid_today,
            'paidWeek' => (int) $row->paid_week,
            'paidMonth' => (int) $row->paid_month,
        ];
    }

    /** Members / 3rd / 4th / revenue — derived from current state, never accumulated. */
    private function stats(bool $canRevenue, array $headline): array
    {
        $fee = (float) config('icpep.membership_fee');
        $live = $headline['live'];
        $paid = $headline['paid'];

        return [
            'members' => $live,
            'thirdYear' => $headline['thirdYear'],
            'fourthYear' => $headline['fourthYear'],
            'paid' => $paid,
            'unpaid' => $live - $paid,
            // Peso figures are the chapter's income — null them out for roles
            // that may read the ledger but not the takings.
            'revenue' => $canRevenue ? $paid * $fee : null,
            'pendingRevenue' => $canRevenue ? ($live - $paid) * $fee : null,
        ];
    }

    /** Fees collected today / this week / this month, from applications.paid_at. */
    private function paymentSummary(array $headline): array
    {
        $fee = (float) config('icpep.membership_fee');
        $today = $headline['paidToday'];
        $week = $headline['paidWeek'];
        $month = $headline['paidMonth'];

        return [
            'today' => ['members' => $today, 'amount' => $today * $fee, 'label' => Carbon::today()->format('M j, Y')],
            'week' => ['members' => $week, 'amount' => $week * $fee, 'label' => Carbon::now()->startOfWeek()->format('M j').' – '.Carbon::now()->endOfWeek()->format('M j')],
            'month' => ['members' => $month, 'amount' => $month * $fee, 'label' => Carbon::now()->format('F Y')],
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
