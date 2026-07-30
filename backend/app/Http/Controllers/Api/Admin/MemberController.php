<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\Application;
use App\Models\MembershipTerm;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer as XlsxWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Members List — read and write. Filters mirror the Filament resource exactly
 * (Year & Section, Payment, Date range, trashed scope) plus search and sort.
 * Writes go through Eloquent so the model's events still fire (activity log +
 * payment ledger), keeping the React admin's effects identical to Filament's.
 */
class MemberController extends Controller
{
    /** Columns the list may be sorted by, mapped to real DB columns. */
    private const SORTABLE = [
        'name' => 'surname',
        'section' => 'section',
        'paidAt' => 'paid_at',
        'createdAt' => 'created_at',
    ];

    /* ------------------------------------------------------------------ read */

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->applySort($this->filtered($request), $request);

        return MemberResource::collection($query->paginate($this->perPage($request))->withQueryString());
    }

    public function show(Application $application): MemberResource
    {
        return (new MemberResource($application))->withFiles();
    }

    /* ----------------------------------------------------------------- writes */

    public function update(Request $request, Application $application): MemberResource
    {
        Gate::authorize('members.edit');

        // Trimmed explicitly so leading/trailing spaces from a pasted ID never
        // defeat the uniqueness check below.
        $request->merge(['studentId' => trim((string) $request->input('studentId'))]);

        $data = $request->validate([
            'surname' => ['required', 'string', 'max:100'],
            'givenName' => ['required', 'string', 'max:100'],
            'middleInitial' => ['nullable', 'string', 'max:1'],
            'studentId' => [
                'required', 'string', 'digits:10',
                Rule::unique('applications', 'student_id')->ignore($application->id),
            ],
            'yearLevel' => ['required', Rule::in(Application::YEAR_LEVELS)],
            'section' => ['required', Rule::in(Application::SECTIONS)],
            'birthday' => ['required', 'date'],
            'address' => ['required', 'string', 'max:500'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'paidAt' => ['nullable', 'date'],
        ]);

        $attributes = [
            'surname' => $data['surname'],
            'given_name' => $data['givenName'],
            'middle_initial' => $data['middleInitial'] ?? null,
            'student_id' => $data['studentId'],
            'year_level' => $data['yearLevel'],
            'section' => $data['section'],
            'birthday' => $data['birthday'],
            'address' => $data['address'],
            'email' => $data['email'],
            'phone' => $data['phone'],
        ];

        // Payment status is a separate, financial permission. An editor without
        // it can't change paid state through the edit form — the existing date
        // is preserved regardless of what the payload carries.
        if (Gate::allows('members.payment')) {
            $attributes['paid_at'] = $data['paidAt'] ?? null;
        }

        $application->update($attributes);

        return (new MemberResource($application->fresh()))->withFiles();
    }

    /** Flip paid state. Marking records today; unmarking clears the date. */
    public function togglePaid(Application $application): MemberResource
    {
        Gate::authorize('members.payment');

        $application->update(['paid_at' => $application->is_paid ? null : now()]);

        return new MemberResource($application->fresh());
    }

    public function destroy(Application $application): JsonResponse
    {
        Gate::authorize('members.edit');

        $application->delete();

        return response()->json(['ok' => true]);
    }

    public function restore(Application $application): MemberResource
    {
        Gate::authorize('members.edit');

        if ($application->trashed()) {
            $application->restore();
        }

        return new MemberResource($application->fresh());
    }

    /** Bulk paid / unpaid / delete / restore over an explicit set of ids. */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in(['paid', 'unpaid', 'delete', 'restore'])],
        ]);

        // Payment actions and edit actions are separate permissions.
        Gate::authorize(in_array($data['action'], ['paid', 'unpaid'], true) ? 'members.payment' : 'members.edit');

        $members = Application::withTrashed()->whereIn('id', $data['ids'])->get();

        match ($data['action']) {
            // Skip members already in the target state so a bulk run never
            // rewrites a payment date that is already on record.
            'paid' => $members->whereNull('paid_at')->each->update(['paid_at' => now()]),
            'unpaid' => $members->whereNotNull('paid_at')->each->update(['paid_at' => null]),
            'delete' => $members->whereNull('deleted_at')->each->delete(),
            'restore' => $members->whereNotNull('deleted_at')->each->restore(),
        };

        return response()->json(['count' => $members->count()]);
    }

    /** Stream a private file (picture|signature) to the officer as a download. */
    public function download(Application $application, string $which): StreamedResponse
    {
        abort_unless(in_array($which, ['picture', 'signature'], true), 404);

        $path = $which === 'picture' ? $application->picture_path : $application->signature_path;
        abort_if(! $path, 404);

        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $name = str($application->full_name)->slug('_')."_{$which}".($ext ? ".{$ext}" : '');

        // Storage::disk() is annotated as returning the Filesystem contract,
        // which declares neither download() nor temporaryUrl(); the concrete
        // FilesystemAdapter it actually returns declares both. Naming the real
        // type keeps static analysis from flagging a call that is fine at
        // runtime.
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('supabase');

        try {
            return $disk->download($path, $name);
        } catch (\Throwable $e) {
            abort(404);
        }
    }

    /* ----------------------------------------------------------------- export */

    /** Column order shared by every export format. */
    private const EXPORT_COLUMNS = [
        'Student ID', 'Full Name', 'Year Level', 'Section', 'Phone', 'Email', 'Payment Status', 'Paid At', 'Registered At',
    ];

    public function exportCsv(Request $request): StreamedResponse
    {
        $members = $this->exportRows($request);

        return response()->streamDownload(function () use ($members): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, self::EXPORT_COLUMNS);
            foreach ($members as $member) {
                fputcsv($out, $this->exportRow($member));
            }
            fclose($out);
        }, $this->exportFilename($request, 'csv'), ['Content-Type' => 'text/csv']);
    }

    public function exportExcel(Request $request): StreamedResponse
    {
        $members = $this->exportRows($request);

        return response()->streamDownload(function () use ($members): void {
            $writer = new XlsxWriter();
            $writer->openToFile('php://output');
            $writer->addRow(Row::fromValues(self::EXPORT_COLUMNS));
            foreach ($members as $member) {
                $writer->addRow(Row::fromValues($this->exportRow($member)));
            }
            $writer->close();
        }, $this->exportFilename($request, 'xlsx'), [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    /** Printable roster: logo, org name, applied filters, table, total, signature blocks. */
    public function exportPdf(Request $request): Response
    {
        $term = MembershipTerm::resolve($request->input('term'));
        $members = $this->exportRows($request);

        $pdf = Pdf::loadView('admin.members.export-pdf', [
            'members' => $members,
            'term' => $term,
            'filters' => $this->filterSummary($request, $term),
            'generatedAt' => now(),
        ])->setPaper('a4', 'portrait');

        return $pdf->stream($this->exportFilename($request, 'pdf'));
    }

    /** Every member the current filters + search match, in list order — unpaginated. */
    private function exportRows(Request $request): Collection
    {
        return $this->applySort($this->filtered($request), $request)->get();
    }

    /** @return list<string> */
    private function exportRow(Application $member): array
    {
        return [
            $member->student_id,
            $member->full_name,
            $member->year_level,
            $member->section,
            $member->phone,
            $member->email,
            $member->is_paid ? 'Paid' : 'Unpaid',
            optional($member->paid_at)->toDateString() ?? '',
            optional($member->created_at)->toDateString() ?? '',
        ];
    }

    private function exportFilename(Request $request, string $ext): string
    {
        $term = MembershipTerm::resolve($request->input('term'));
        $slug = $term ? str($term->label)->slug() : 'members-list';

        return "members-list-{$slug}-".now()->format('Y-m-d').".{$ext}";
    }

    /** Human-readable list of the filters currently applied, for the PDF header. */
    private function filterSummary(Request $request, ?MembershipTerm $term): array
    {
        $summary = [];

        if ($term) {
            $summary['Semester'] = $term->label;
        }
        if ($class = $request->input('class')) {
            $summary['Year & Section'] = $class;
        }
        if ($payment = $request->input('payment')) {
            $summary['Payment'] = ucfirst($payment);
        }
        if ($trashed = $request->input('trashed')) {
            $summary['Records'] = $trashed === 'only' ? 'Deleted members only' : 'Including deleted members';
        }
        if ($search = trim((string) $request->input('search'))) {
            $summary['Search'] = $search;
        }

        return $summary;
    }

    /* ---------------------------------------------------------------- helpers */

    /** Apply the list filters + search to the index query. */
    private function filtered(Request $request): Builder
    {
        $query = Application::query();

        // Every list is one semester's membership list. Without a `term` the
        // current one is used, so the module opens on the live roster.
        if ($term = MembershipTerm::resolve($request->input('term'))) {
            $query->forTerm($term->id);
        }

        match ($request->input('trashed')) {
            'with' => $query->withTrashed(),
            'only' => $query->onlyTrashed(),
            default => $query,
        };

        if ($class = $request->input('class')) {
            $query->inClass($class);
        }

        match ($request->input('payment')) {
            'paid' => $query->paid(),
            'unpaid' => $query->unpaid(),
            default => $query,
        };

        $this->applyDateRange($query, $request);

        if ($search = trim((string) $request->input('search'))) {
            // whereLike(..., caseSensitive: false) compiles to ILIKE on Postgres
            // and a LOWER() comparison elsewhere, so this stays case-insensitive
            // on both the sqlite test DB and the Supabase/Postgres database.
            $query->where(function (Builder $q) use ($search): void {
                $q->whereLike('surname', "%{$search}%")
                    ->orWhereLike('given_name', "%{$search}%")
                    ->orWhereLike('email', "%{$search}%")
                    ->orWhereLike('student_id', "%{$search}%")
                    ->orWhereLike('phone', "%{$search}%")
                    ->orWhereLike('section', "%{$search}%");
            });
        }

        return $query;
    }

    /** Inclusive date range over created_at / paid_at / birthday. */
    private function applyDateRange(Builder $query, Request $request): void
    {
        $field = in_array($request->input('dateField'), ['created_at', 'paid_at', 'birthday'], true)
            ? $request->input('dateField')
            : 'created_at';

        $query
            ->when($request->input('from'), fn (Builder $q, $d): Builder => $q->whereDate($field, '>=', $d))
            ->when($request->input('until'), fn (Builder $q, $d): Builder => $q->whereDate($field, '<=', $d));
    }

    /** Sort mirrors the list's column sort (and its default) for index and exports alike. */
    private function applySort(Builder $query, Request $request): Builder
    {
        $sort = self::SORTABLE[$request->input('sort')] ?? 'created_at';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy($sort, $direction);
    }

    /** 20 by default — a page the admin table shows without the browser scrolling. */
    private function perPage(Request $request): int
    {
        $perPage = (int) $request->integer('perPage', 20);

        return in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;
    }
}
