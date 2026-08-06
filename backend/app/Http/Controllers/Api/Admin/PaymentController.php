<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentTransactionResource;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
     * Keyed on PaymentTransaction::cacheVersion($term?->id), which every
     * write to that term bumps (see that model and MemberController's bulk
     * payment methods) — so a cached page is never served past the write
     * that changed it, same as before, but the version is now scoped per
     * term rather than one global counter: recording a payment in the
     * current term no longer invalidates every other term's already-cached
     * pages along with it. The TTL below is only a backstop against the
     * cache growing forever with old filter/page combinations nobody's
     * asked for since, not what keeps this correct. The one gap that TTL
     * does bound: renaming a member in the Members List doesn't itself bump
     * the version, so a cached *search* hit on their old name can outlive
     * the rename by up to the TTL.
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

    /**
     * Same rows and pagination meta a plain ->paginate() would produce, in
     * one query rather than three: paginate() runs a COUNT, then a SELECT,
     * then (via ->with('membershipTerm')) a third query to fetch back the
     * one term every row on the page already belongs to. Against a remote,
     * pooled Postgres connection each of those is a network round trip on
     * top of its execution time, and they run one after another — so this
     * is the difference between three round trips and one for the common
     * case (a term is selected, the page has rows), which is every officer's
     * "just open Payment History" request.
     *
     * @return array<string, mixed>
     */
    private function fetch(Request $request, ?MembershipTerm $term, int $perPage): array
    {
        $base = $this->filtered($request, $term)->latest();
        $page = Paginator::resolveCurrentPage();

        // count(*) over () rides along with each returned row instead of
        // running as its own query — the same total the separate COUNT
        // paginate() runs would have returned, just carried on the rows
        // already being fetched.
        $rows = (clone $base)
            ->selectRaw('payment_transactions.*, count(*) over () as total_count')
            ->forPage($page, $perPage)
            ->get();

        $total = match (true) {
            $rows->isNotEmpty() => (int) $rows->first()->total_count,
            // Nothing at all on the first page — the ledger (under these
            // filters) is genuinely empty, no need to ask again.
            $page === 1 => 0,
            // A page past the last one: the window function's count only
            // rides along with rows that come back, so an out-of-range page
            // has none to carry it — this is the one case that still needs
            // a real COUNT, same as paginate() would always pay for anyway.
            default => (clone $base)->toBase()->getCountForPagination(),
        };

        if ($term) {
            // Every row here already belongs to $term — filtered() scoped
            // the query with forTerm() — so the relation the resource needs
            // (badging "(Current)" or a school-year label) is set directly
            // from the term already resolved in index(), instead of a
            // second round trip to fetch back the exact row this request
            // already has.
            $rows->each(fn (PaymentTransaction $row) => $row->setRelation('membershipTerm', $term));
        } else {
            // No single term to attribute every row to (the untermed "all
            // terms" view) — fall back to a real eager load.
            $rows->load('membershipTerm');
        }

        $paginator = (new LengthAwarePaginator($rows, $total, $perPage, $page, [
            'path' => Paginator::resolveCurrentPath(),
        ]))->withQueryString();

        return PaymentTransactionResource::collection($paginator)
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
            ->latest()
            ->get();

        // Same round-trip saving as fetch(): every row here already belongs
        // to $term, so the relation is set from the term already resolved
        // above rather than re-fetched — worth doing here too since this
        // endpoint is polled every few seconds while the page is open.
        if ($term) {
            $rows->each(fn (PaymentTransaction $row) => $row->setRelation('membershipTerm', $term));
        } else {
            $rows->load('membershipTerm');
        }

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

        // Leading-wildcard LIKE — no B-tree index (including the ones this
        // model has) can serve it, so this is a sequential scan of both
        // tables by design. Left as a plain LIKE rather than a pg_trgm GIN
        // trigram index deliberately: at this org's scale (a per-term roster
        // sized in the hundreds — see MemberBulkSeeder's 250-row target) a
        // Postgres seq scan over a few hundred rows costs a fraction of a
        // millisecond, so a trigram index would spend a real write-time and
        // storage cost (plus a `CREATE EXTENSION pg_trgm` migration) buying
        // back time nobody is waiting on. Ordered cheapest-first (plain
        // column LIKEs before the EXISTS subquery) for whatever marginal
        // help that gives the planner.
        //
        // Revisit if either table's row count climbs into the low thousands
        // (several terms' worth of history) or a search is ever *measured*
        // slow: add `CREATE EXTENSION IF NOT EXISTS pg_trgm;` plus
        // `CREATE INDEX ... USING gin (column gin_trgm_ops)` on
        // member_name/actor_name/actor here and surname/given_name/email on
        // applications, then swap these LIKEs for `whereRaw('column ILIKE
        // ?', ...)` (trigram indexes require ILIKE/LIKE, not Eloquent's
        // portable 'like' operator, to be picked up on Postgres).
        if ($search = trim((string) $request->query('search'))) {
            $query->where(function (Builder $q) use ($search): void {
                $q->where('member_name', 'like', "%{$search}%")
                    // The name is what the table shows, so it has to be what
                    // the search matches; email stays searchable behind it.
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('actor', 'like', "%{$search}%")
                    ->orWhereHas('application', fn (Builder $a): Builder => $a
                        ->where('surname', 'like', "%{$search}%")
                        ->orWhere('given_name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"));
            });
        }

        return $query;
    }

    /** Every input that changes the result, plus the cache generation for
        this term, folded into one key — so a write to this term invalidates
        every cached combination *for this term* at once just by bumping its
        version, without leaving other terms' cached pages stale forever or
        having to enumerate every combination by hand. */
    private function cacheKey(Request $request, ?MembershipTerm $term, int $perPage): string
    {
        return 'payments.index.'.md5(serialize([
            PaymentTransaction::cacheVersion($term?->id),
            $term?->id,
            $request->query('action'),
            $request->query('kind'),
            $request->query('class'),
            trim((string) $request->query('search')),
            $perPage,
            (int) $request->integer('page', 1),
        ]));
    }

    /* ----------------------------------------------------------------- export */

    /** Column order shared by every export format — mirrors MemberController's. */
    private const EXPORT_COLUMNS = [
        'Member', 'Section', 'Year Level', 'Event', 'Batch', 'Amount', 'Semester', 'Recorded At', 'Recorded By',
    ];

    /**
     * Columns exportRow() (and the PDF view) actually read. The ledger
     * already denormalises member_name/section/year_level onto the row
     * itself (see PaymentTransaction), so — unlike MemberController's
     * export — this never needs to join `applications` at all.
     */
    private const EXPORT_SELECT_COLUMNS = [
        'id', 'membership_term_id', 'member_name', 'section', 'year_level',
        'action', 'kind', 'amount', 'actor', 'actor_name', 'actor_role', 'created_at',
    ];

    /** Human-readable labels — same wording PaymentHistory.tsx's EVENT/KIND_LABEL show on screen. */
    private const ACTION_LABELS = [
        PaymentTransaction::PAID => 'Paid',
        PaymentTransaction::REVOKED => 'Revoked',
        PaymentTransaction::ADJUSTED => 'Date Adjusted',
    ];

    private const KIND_LABELS = [
        PaymentTransaction::PAYMENT_1 => 'Payment 1',
        PaymentTransaction::PAYMENT_2 => 'Payment 2',
    ];

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->exportRows($request);

        return response()->streamDownload(function () use ($rows): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, self::EXPORT_COLUMNS);
            foreach ($rows as $row) {
                fputcsv($out, array_map(self::escapeCsvFormula(...), $this->exportRow($row)));
            }
            fclose($out);
        }, $this->exportFilename($request, 'csv'), ['Content-Type' => 'text/csv']);
    }

    /**
     * Same formula-injection guard as MemberController::escapeCsvFormula —
     * member_name and actor both ultimately trace back to free-text names
     * (the public application form, and an officer's own account name), so
     * the risk is identical and the fix is identical.
     */
    private static function escapeCsvFormula(?string $value): string
    {
        $value ??= '';

        return str_starts_with($value, '=')
            || str_starts_with($value, '+')
            || str_starts_with($value, '-')
            || str_starts_with($value, '@')
            || str_starts_with($value, "\t")
            || str_starts_with($value, "\r")
            ? "'".$value
            : $value;
    }

    public function exportExcel(Request $request): StreamedResponse
    {
        $rows = $this->exportRows($request);

        return response()->streamDownload(function () use ($rows): void {
            $writer = new XlsxWriter;
            $writer->openToFile('php://output');
            $writer->addRow(Row::fromValues(self::EXPORT_COLUMNS));
            foreach ($rows as $row) {
                $writer->addRow(Row::fromValues($this->exportRow($row)));
            }
            $writer->close();
        }, $this->exportFilename($request, 'xlsx'), [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** Printable ledger: logo, org name, applied filters, table, total. */
    public function exportPdf(Request $request): Response
    {
        $term = MembershipTerm::resolve($request->input('term'));
        $rows = $this->exportRows($request);

        $pdf = Pdf::loadView('admin.payments.export-pdf', [
            'transactions' => $rows,
            'term' => $term,
            'filters' => $this->filterSummary($request, $term),
            'actionLabels' => self::ACTION_LABELS,
            'kindLabels' => self::KIND_LABELS,
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream($this->exportFilename($request, 'pdf'));
    }

    /** Every transaction the current filters + search match, in list order — unpaginated. */
    private function exportRows(Request $request): Collection
    {
        $term = MembershipTerm::resolve($request->query('term'));

        return $this->filtered($request, $term)
            ->with('membershipTerm')
            ->latest()
            ->select(self::EXPORT_SELECT_COLUMNS)
            ->get();
    }

    /** @return list<string> */
    private function exportRow(PaymentTransaction $row): array
    {
        return [
            $row->member_name,
            $row->section ?? '',
            $row->year_level ?? '',
            self::ACTION_LABELS[$row->action] ?? ucfirst($row->action),
            self::KIND_LABELS[$row->kind] ?? $row->kind,
            number_format((float) $row->amount, 2),
            $row->membershipTerm?->label ?? '',
            optional($row->created_at)->toDateTimeString() ?? '',
            $this->recordedByLabel($row),
        ];
    }

    /** "Juan Dela Cruz (Treasurer)" — name over email, role alongside for the
        same transparency the on-screen "By" column shows. */
    private function recordedByLabel(PaymentTransaction $row): string
    {
        $name = $row->actor_name ?: $row->actor;
        if (! $name) {
            return 'System';
        }

        $role = $row->actor_role ? (UserRole::tryFrom($row->actor_role)?->label() ?? $row->actor_role) : null;

        return $role ? "{$name} ({$role})" : $name;
    }

    private function exportFilename(Request $request, string $ext): string
    {
        $term = MembershipTerm::resolve($request->input('term'));
        $slug = $term ? str($term->label)->slug() : 'payment-history';

        return "payment-history-{$slug}-".now()->format('Y-m-d').".{$ext}";
    }

    /** Human-readable list of the filters currently applied, for the PDF header. */
    private function filterSummary(Request $request, ?MembershipTerm $term): array
    {
        $summary = [];

        if ($term) {
            $summary['Semester'] = $term->label;
        }
        if ($action = $request->input('action')) {
            $summary['Event'] = self::ACTION_LABELS[$action] ?? ucfirst($action);
        }
        if ($kind = $request->input('kind')) {
            $summary['Batch'] = self::KIND_LABELS[$kind] ?? $kind;
        }
        if ($class = $request->input('class')) {
            $summary['Year & Section'] = $class;
        }
        if ($search = trim((string) $request->input('search'))) {
            $summary['Search'] = $search;
        }

        return $summary;
    }
}
