<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
        // roles that may access the financial modules; everyone else gets the
        // membership counts and charts. The frontend hides the same cards.
        $canFinance = Gate::allows('finance.view');
        $term = MembershipTerm::resolve($request->query('term'));

        return response()->json([
            'stats' => $this->stats($canFinance, $term),
            'paymentSummary' => $canFinance ? $this->paymentSummary($term) : null,
            'membersByClass' => $this->membersByClass($term),
            'registrationsOverTime' => $this->registrationsOverTime($term),
            'canViewFinance' => $canFinance,
            'term' => $term ? ['id' => $term->id, 'label' => $term->label, 'isCurrent' => $term->is_current] : null,
        ]);
    }

    /** Live counts for the sidebar nav badges (members, payment records). */
    public function counts(Request $request): JsonResponse
    {
        $term = MembershipTerm::resolve($request->query('term'));

        $payments = PaymentTransaction::query();
        if ($term) {
            $payments->forTerm($term->id);
        }

        return response()->json([
            'members' => $this->members($term)->count(),
            'payments' => $payments->count(),
            // Accounts are organization-wide, not per-semester.
            'users' => User::count(),
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

    /** Members / 3rd / 4th / revenue — derived from current state, never accumulated. */
    private function stats(bool $canFinance, ?MembershipTerm $term): array
    {
        $fee = (float) config('icpep.membership_fee');

        $live = $this->members($term)->count();
        $paid = $this->members($term)->paid()->count();

        return [
            'members' => $live,
            'thirdYear' => $this->members($term)->where('year_level', '3rd Year')->count(),
            'fourthYear' => $this->members($term)->where('year_level', '4th Year')->count(),
            'paid' => $paid,
            'unpaid' => $live - $paid,
            // Peso figures are financial — null them out for non-finance roles.
            'revenue' => $canFinance ? $paid * $fee : null,
            'pendingRevenue' => $canFinance ? ($live - $paid) * $fee : null,
        ];
    }

    /** Fees collected today / this week / this month, from applications.paid_at. */
    private function paymentSummary(?MembershipTerm $term): array
    {
        $fee = (float) config('icpep.membership_fee');

        $countBetween = fn (Carbon $from, Carbon $until): int => $this->members($term)
            ->whereBetween('paid_at', [$from, $until])
            ->count();

        $today = $countBetween(Carbon::today()->startOfDay(), Carbon::today()->endOfDay());
        $week = $countBetween(Carbon::now()->startOfWeek(), Carbon::now()->endOfWeek());
        $month = $countBetween(Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth());

        return [
            'today' => ['members' => $today, 'amount' => $today * $fee, 'label' => Carbon::today()->format('M j, Y')],
            'week' => ['members' => $week, 'amount' => $week * $fee, 'label' => Carbon::now()->startOfWeek()->format('M j').' – '.Carbon::now()->endOfWeek()->format('M j')],
            'month' => ['members' => $month, 'amount' => $month * $fee, 'label' => Carbon::now()->format('F Y')],
        ];
    }

    /** Headcount per 3A/3B/4A/4B. */
    private function membersByClass(?MembershipTerm $term): array
    {
        $counts = collect(Application::CLASS_MAP)->map(
            fn (array $c): int => $this->members($term)
                ->where('year_level', $c[0])
                ->where('section', $c[1])
                ->count()
        );

        return [
            'labels' => array_keys(Application::CLASS_MAP),
            'data' => $counts->values()->all(),
        ];
    }

    /** New members per month over the last six months. */
    private function registrationsOverTime(?MembershipTerm $term): array
    {
        $months = collect(range(5, 0))->map(fn (int $i): Carbon => now()->startOfMonth()->subMonths($i));

        return [
            'labels' => $months->map(fn (Carbon $m): string => $m->format('M Y'))->all(),
            'data' => $months->map(fn (Carbon $m): int => $this->members($term)->whereBetween('created_at', [
                $m->copy()->startOfMonth(),
                $m->copy()->endOfMonth(),
            ])->count())->all(),
        ];
    }
}
