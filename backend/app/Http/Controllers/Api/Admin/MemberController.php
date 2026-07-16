<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\Application;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
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
        $query = $this->filtered($request);

        $sort = self::SORTABLE[$request->input('sort')] ?? 'created_at';
        $direction = $request->input('direction') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction);

        return MemberResource::collection($query->paginate($this->perPage($request))->withQueryString());
    }

    public function show(Application $application): MemberResource
    {
        return (new MemberResource($application))->withFiles();
    }

    /* ----------------------------------------------------------------- writes */

    public function update(Request $request, Application $application): MemberResource
    {
        $data = $request->validate([
            'surname' => ['required', 'string', 'max:100'],
            'givenName' => ['required', 'string', 'max:100'],
            'middleInitial' => ['nullable', 'string', 'max:1'],
            'yearLevel' => ['required', Rule::in(Application::YEAR_LEVELS)],
            'section' => ['required', Rule::in(Application::SECTIONS)],
            'birthday' => ['required', 'date'],
            'address' => ['required', 'string', 'max:500'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'paidAt' => ['nullable', 'date'],
        ]);

        $application->update([
            'surname' => $data['surname'],
            'given_name' => $data['givenName'],
            'middle_initial' => $data['middleInitial'] ?? null,
            'year_level' => $data['yearLevel'],
            'section' => $data['section'],
            'birthday' => $data['birthday'],
            'address' => $data['address'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'paid_at' => $data['paidAt'] ?? null,
        ]);

        return (new MemberResource($application->fresh()))->withFiles();
    }

    /** Flip paid state. Marking records today; unmarking clears the date. */
    public function togglePaid(Application $application): MemberResource
    {
        $application->update(['paid_at' => $application->is_paid ? null : now()]);

        return new MemberResource($application->fresh());
    }

    public function destroy(Application $application): JsonResponse
    {
        $application->delete();

        return response()->json(['ok' => true]);
    }

    public function restore(Application $application): MemberResource
    {
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

    /** Mark every member the current filters are showing (and still unpaid) as paid. */
    public function markAllPaid(Request $request): JsonResponse
    {
        $members = $this->filtered($request)->whereNull('paid_at')->get();
        $count = $members->count();
        $members->each->update(['paid_at' => now()]);

        return response()->json(['count' => $count]);
    }

    /** Stream a private file (picture|signature) to the officer as a download. */
    public function download(Application $application, string $which): StreamedResponse
    {
        abort_unless(in_array($which, ['picture', 'signature'], true), 404);

        $path = $which === 'picture' ? $application->picture_path : $application->signature_path;
        abort_if(! $path, 404);

        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $name = str($application->full_name)->slug('_')."_{$which}".($ext ? ".{$ext}" : '');

        try {
            return Storage::disk('supabase')->download($path, $name);
        } catch (\Throwable $e) {
            abort(404);
        }
    }

    /* ---------------------------------------------------------------- helpers */

    /** Apply the list filters + search. Reads from input() so it works whether
        the params arrive on a GET query string or a POST body (mark-all-paid). */
    private function filtered(Request $request): Builder
    {
        $query = Application::query();

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
            $query->where(function (Builder $q) use ($search): void {
                $q->where('surname', 'like', "%{$search}%")
                    ->orWhere('given_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
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

    private function perPage(Request $request): int
    {
        $perPage = (int) $request->integer('perPage', 25);

        return in_array($perPage, [25, 50, 100], true) ? $perPage : 25;
    }
}
