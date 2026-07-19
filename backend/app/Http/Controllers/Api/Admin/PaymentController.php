<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentTransactionResource;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Read-only payment-history ledger. Filters mirror the Filament resource: Event,
 * Section, and a Date range over the payment date or the recorded date. Search
 * matches the snapshot name and the live member record, so a member renamed
 * after paying is findable under either name.
 */
class PaymentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = PaymentTransaction::query()->latest();

        // Scoped to one semester's membership list, so a term's ledger and its
        // member count describe the same set of people.
        if ($term = MembershipTerm::resolve($request->query('term'))) {
            $query->forTerm($term->id);
        }

        if ($action = $request->query('action')) {
            if (in_array($action, [PaymentTransaction::PAID, PaymentTransaction::REVOKED, PaymentTransaction::ADJUSTED], true)) {
                $query->where('action', $action);
            }
        }

        if ($section = $request->query('section')) {
            $query->where('section', $section);
        }

        $this->applyDateRange($query, $request);

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

        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        return PaymentTransactionResource::collection($query->paginate($perPage)->withQueryString());
    }

    private function applyDateRange(Builder $query, Request $request): void
    {
        $field = in_array($request->query('dateField'), ['effective_at', 'created_at'], true)
            ? $request->query('dateField')
            : 'effective_at';

        $query
            ->when($request->query('from'), fn (Builder $q, $d): Builder => $q->whereDate($field, '>=', $d))
            ->when($request->query('until'), fn (Builder $q, $d): Builder => $q->whereDate($field, '<=', $d));
    }
}
