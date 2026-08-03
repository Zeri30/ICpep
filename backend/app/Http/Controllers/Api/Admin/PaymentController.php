<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentTransactionResource;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;

/**
 * Read-only payment-history ledger, open to every administrator for
 * transparency. Filters are Event and Section; search matches the snapshot name
 * and the live member record, so a member renamed after paying is findable under
 * either name.
 */
class PaymentController extends Controller
{
    /**
     * The resolved page (rows + pagination meta, already run through the
     * resource) is cached rather than re-querying every open of this screen:
     * the ledger is written to far less often than it's read (every officer
     * who opens Payment History re-runs the same handful of common
     * combinations — no filters, page 1, above all), and the search variant
     * in particular pays for a LIKE '%...%' over two tables (see filtered()
     * below) that no index can speed up.
     *
     * Keyed on PaymentTransaction::cacheVersion(), which every write bumps
     * (see that model and MemberController's bulk payment methods), so a
     * cached page is never served past the write that changed it — the TTL
     * below is only a backstop against the cache growing forever with old
     * filter/page combinations nobody's asked for since, not what keeps this
     * correct. The one gap that TTL does bound: renaming a member in the
     * Members List doesn't itself bump the version, so a cached *search* hit
     * on their old name can outlive the rename by up to the TTL.
     */
    private const CACHE_TTL_MINUTES = 5;

    public function index(Request $request): JsonResponse
    {
        $term = MembershipTerm::resolve($request->query('term'));
        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        $key = $this->cacheKey($request, $term, $perPage);

        $payload = Cache::remember(
            $key,
            now()->addMinutes(self::CACHE_TTL_MINUTES),
            fn (): array => $this->fetch($request, $term, $perPage),
        );

        return response()->json($payload);
    }

    /** @return array<string, mixed> */
    private function fetch(Request $request, ?MembershipTerm $term, int $perPage): array
    {
        // Eager loaded, not queried per-row: the resource needs `is_current`
        // off of it to badge each event "(Current)" or a school-year label.
        $query = $this->filtered($request, $term)->with('membershipTerm')->latest();

        return PaymentTransactionResource::collection($query->paginate($perPage)->withQueryString())
            ->response()
            ->getData(true);
    }

    /**
     * New ledger rows since a point in time, matching the same filters the
     * caller's own list view is showing — polled every few seconds so an
     * officer's Payment History picks up a payment another officer just
     * recorded, without a manual refresh. Unpaginated: the window between
     * polls is seconds wide, so this is expected to return a handful of rows
     * at most, never a full page's worth.
     */
    public function changes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'since' => ['required', 'date'],
        ]);

        // Captured before the query runs — see MemberController::changes for
        // why this has to happen first rather than after.
        $now = Carbon::now();
        $term = MembershipTerm::resolve($request->query('term'));

        // Parsed into a real Carbon instance — see MemberController::changes
        // for why the raw validated string can't be used as-is here.
        $rows = $this->filtered($request, $term)
            ->where('created_at', '>', Carbon::parse($data['since']))
            ->with('membershipTerm')
            ->latest()
            ->get();

        return response()->json([
            'added' => PaymentTransactionResource::collection($rows)->resolve(),
            'since' => $now->toIso8601String(),
        ]);
    }

    /** The Event/batch/class/search filters shared by index() and changes(),
        so a poll only ever reports rows the caller's own view would show. */
    private function filtered(Request $request, ?MembershipTerm $term): Builder
    {
        $query = PaymentTransaction::query();

        // Scoped to one semester's membership list, so a term's ledger and its
        // member count describe the same set of people.
        if ($term) {
            $query->forTerm($term->id);
        }

        if ($action = $request->query('action')) {
            if (in_array($action, [PaymentTransaction::PAID, PaymentTransaction::REVOKED, PaymentTransaction::ADJUSTED], true)) {
                $query->where('action', $action);
            }
        }

        // Which of the two sequential payment batches — same indexed-column
        // filter treatment as `action` above.
        if ($kind = $request->query('kind')) {
            if (in_array($kind, [PaymentTransaction::PAYMENT_1, PaymentTransaction::PAYMENT_2], true)) {
                $query->where('kind', $kind);
            }
        }

        // Same combined year+section codes ("3A".."4B") the Members List filters
        // on, so the two modules read the same way.
        if ($class = $request->query('class')) {
            $query->inClass($class);
        }

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function (Builder $q) use ($search): void {
                $q->where('member_name', 'like', "%{$search}%")
                    ->orWhere('actor', 'like', "%{$search}%")
                    ->orWhereHas('application', fn (Builder $a): Builder => $a
                        ->where('surname', 'like', "%{$search}%")
                        ->orWhere('given_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"));
            });
        }

        return $query;
    }

    /** Every input that changes the result, plus the cache generation, folded
        into one key — so a write invalidates every cached combination at once
        just by bumping the version, rather than this having to enumerate them. */
    private function cacheKey(Request $request, ?MembershipTerm $term, int $perPage): string
    {
        return 'payments.index.'.md5(serialize([
            PaymentTransaction::cacheVersion(),
            $term?->id,
            $request->query('action'),
            $request->query('kind'),
            $request->query('class'),
            trim((string) $request->query('search')),
            $perPage,
            (int) $request->integer('page', 1),
        ]));
    }
}
