<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;

/**
 * The dashboard's four widgets in one payload: headline stats, the
 * today/week/month payment summary, and the two charts. The computations mirror
 * the Filament widgets one-for-one so the numbers match exactly.
 */
class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        // Money figures (revenue and the payment summary) are only returned to
        // roles that may access the financial modules; everyone else gets the
        // membership counts and charts. The frontend hides the same cards.
        $canFinance = Gate::allows('finance.view');

        return response()->json([
            'stats' => $this->stats($canFinance),
            'paymentSummary' => $canFinance ? $this->paymentSummary() : null,
            'membersByClass' => $this->membersByClass(),
            'registrationsOverTime' => $this->registrationsOverTime(),
            'canViewFinance' => $canFinance,
        ]);
    }

    /** Live counts for the sidebar nav badges (members, payment records). */
    public function counts(): JsonResponse
    {
        return response()->json([
            'members' => Application::count(),
            'payments' => PaymentTransaction::count(),
            'users' => User::count(),
        ]);
    }

    /** Members / 3rd / 4th / revenue — derived from current state, never accumulated. */
    private function stats(bool $canFinance): array
    {
        $fee = (float) config('icpep.membership_fee');

        $live = Application::count();
        $paid = Application::paid()->count();

        return [
            'members' => $live,
            'thirdYear' => Application::where('year_level', '3rd Year')->count(),
            'fourthYear' => Application::where('year_level', '4th Year')->count(),
            'paid' => $paid,
            'unpaid' => $live - $paid,
            // Peso figures are financial — null them out for non-finance roles.
            'revenue' => $canFinance ? $paid * $fee : null,
            'pendingRevenue' => $canFinance ? ($live - $paid) * $fee : null,
        ];
    }

    /** Fees collected today / this week / this month, from applications.paid_at. */
    private function paymentSummary(): array
    {
        $fee = (float) config('icpep.membership_fee');

        $countBetween = fn (Carbon $from, Carbon $until): int => Application::query()
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
    private function membersByClass(): array
    {
        $counts = collect(Application::CLASS_MAP)->map(
            fn (array $c): int => Application::where('year_level', $c[0])->where('section', $c[1])->count()
        );

        return [
            'labels' => array_keys(Application::CLASS_MAP),
            'data' => $counts->values()->all(),
        ];
    }

    /** New members per month over the last six months. */
    private function registrationsOverTime(): array
    {
        $months = collect(range(5, 0))->map(fn (int $i): Carbon => now()->startOfMonth()->subMonths($i));

        return [
            'labels' => $months->map(fn (Carbon $m): string => $m->format('M Y'))->all(),
            'data' => $months->map(fn (Carbon $m): int => Application::whereBetween('created_at', [
                $m->copy()->startOfMonth(),
                $m->copy()->endOfMonth(),
            ])->count())->all(),
        ];
    }
}
