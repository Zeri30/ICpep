<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\Application;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read side of the Members List. Filters mirror the Filament resource exactly:
 * Year & Section, Payment, a Date range over a chosen field, and the trashed
 * scope — plus search and sort. Writes arrive in Batch 2.
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

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->filtered($request);

        $sort = self::SORTABLE[$request->query('sort')] ?? 'created_at';
        $direction = $request->query('direction') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction);

        $perPage = (int) $request->integer('perPage', 25);
        $perPage = in_array($perPage, [25, 50, 100], true) ? $perPage : 25;

        return MemberResource::collection($query->paginate($perPage)->withQueryString());
    }

    public function show(Application $application): MemberResource
    {
        return (new MemberResource($application))->withFiles();
    }

    /** Apply the list filters + search to a query. */
    private function filtered(Request $request): Builder
    {
        $query = Application::query();

        // Trashed scope: active (default) | with | only.
        match ($request->query('trashed')) {
            'with' => $query->withTrashed(),
            'only' => $query->onlyTrashed(),
            default => $query,
        };

        if ($class = $request->query('class')) {
            $query->inClass($class);
        }

        match ($request->query('payment')) {
            'paid' => $query->paid(),
            'unpaid' => $query->unpaid(),
            default => $query,
        };

        $this->applyDateRange($query, $request);

        if ($search = trim((string) $request->query('search'))) {
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
        $field = in_array($request->query('dateField'), ['created_at', 'paid_at', 'birthday'], true)
            ? $request->query('dateField')
            : 'created_at';

        // whereDate keeps both bounds inclusive; a timestamp compared against a
        // bare date would otherwise drop everything after midnight on the end day.
        $query
            ->when($request->query('from'), fn (Builder $q, $d): Builder => $q->whereDate($field, '>=', $d))
            ->when($request->query('until'), fn (Builder $q, $d): Builder => $q->whereDate($field, '<=', $d));
    }
}
