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
 * Read-only payment-history ledger, open to every administrator for
 * transparency. Filters are Event and Section; search matches the snapshot name
 * and the live member record, so a member renamed after paying is findable under
 * either name.
 */
class PaymentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        // Eager loaded, not queried per-row: the resource needs `is_current`
        // off of it to badge each event "(Current)" or a school-year label.
        $query = PaymentTransaction::query()->with('membershipTerm')->latest();

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

        $perPage = (int) $request->integer('perPage', 20);
        $perPage = in_array($perPage, [20, 25, 50, 100], true) ? $perPage : 20;

        return PaymentTransactionResource::collection($query->paginate($perPage)->withQueryString());
    }
}
