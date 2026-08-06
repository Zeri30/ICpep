<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MemberResource;
use App\Models\ActivityLog;
use App\Models\Application;
use App\Models\MembershipTerm;
use App\Models\PaymentTransaction;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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
        'payment2PaidAt' => 'payment2_paid_at',
        'createdAt' => 'created_at',
    ];

    /* ------------------------------------------------------------------ read */

    /**
     * Columns the list actually reads. Excludes `signature_path` (only ever
     * needed on a single record, via MemberResource::withFiles on `show()`) and
     * `updated_at` (not read by MemberResource at all). `address` and
     * `birthday` stay even though the table doesn't render them: EditMemberModal
     * opens straight off a list row with no fetch of its own, so trimming those
     * would silently blank both fields the moment an officer edits from here.
     */
    private const LIST_COLUMNS = [
        'id', 'membership_term_id', 'surname', 'given_name', 'middle_initial',
        'student_id', 'year_level', 'section', 'birthday', 'address', 'email',
        'phone', 'picture_path', 'paid_at', 'payment2_paid_at', 'created_at', 'deleted_at',
    ];

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = $this->applySort($this->filtered($request), $request)->select(self::LIST_COLUMNS);

        return MemberResource::collection($query->paginate($this->perPage($request))->withQueryString());
    }

    /** Columns changes() needs to rebuild paymentSnapshot() for an affected member. */
    private const CHANGES_COLUMNS = ['id', 'paid_at', 'payment2_paid_at'];

    /**
     * Payment-state changes since a point in time, scoped to one term — polled
     * by the client every few seconds so an officer's Members List picks up a
     * payment another officer just recorded, without a manual refresh and
     * without refetching the whole page. Only the affected rows are returned,
     * shaped exactly like bulk()'s `updated` — the client patches both through
     * the same function.
     *
     * Sourced from payment_transactions rather than applications.updated_at,
     * so an unrelated field edit (address, phone, ...) never gets misread as
     * a payment change and pushed to every open tab.
     */
    public function changes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'since' => ['required', 'date'],
        ]);

        // Captured before the query runs and handed back as the client's next
        // `since`, so a transaction landing between the query and this line is
        // caught by the *next* poll's `> since` — never dropped, and never
        // re-delivered the way reading `now()` after the query would risk.
        $now = Carbon::now();
        $term = MembershipTerm::resolve($request->query('term'));

        // Parsed into a real Carbon instance rather than passed through as the
        // raw validated string: Laravel formats a DateTimeInterface binding to
        // match the connection's own datetime format, where a hand-formatted
        // ISO 8601 string (with its literal "T" and UTC offset) would compare
        // incorrectly against how SQLite/Postgres actually store the column.
        $applicationIds = PaymentTransaction::query()
            ->when($term, fn (Builder $q): Builder => $q->forTerm($term->id))
            ->where('created_at', '>', Carbon::parse($data['since']))
            ->distinct()
            ->pluck('application_id');

        $updated = $applicationIds->isEmpty()
            ? []
            : Application::withTrashed()->whereIn('id', $applicationIds)
                ->select(self::CHANGES_COLUMNS)
                ->get()
                ->map(fn (Application $member): array => $this->paymentSnapshot($member))
                ->values()
                ->all();

        return response()->json(['updated' => $updated, 'since' => $now->toIso8601String()]);
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
                // Scoped to this member's own term, same as the public form's
                // per-term uniqueness (applications_term_student_id_active_unique)
                // — an ID may legitimately repeat across terms, since the same
                // student re-registers every semester.
                Rule::unique('applications', 'student_id')
                    ->where(fn ($query) => $query->where('membership_term_id', $application->membership_term_id))
                    ->whereNull('deleted_at')
                    ->ignore($application->id),
            ],
            'yearLevel' => ['required', Rule::in(Application::YEAR_LEVELS)],
            'section' => ['required', Rule::in(Application::SECTIONS)],
            'birthday' => ['required', 'date'],
            'address' => ['required', 'string', 'max:500'],
            'email' => ['required', 'email', 'max:150'],
            'phone' => ['required', 'string', 'max:30'],
            'paidAt' => ['nullable', 'date'],
            'payment2PaidAt' => ['nullable', 'date'],
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
        // it can't change paid state through the edit form — the existing dates
        // are preserved regardless of what the payload carries.
        if (Gate::allows('members.payment')) {
            $payment1 = $data['paidAt'] ?? null;
            $payment2 = $data['payment2PaidAt'] ?? null;

            // Whatever route got here, the two columns can't end up with
            // Payment 2 paid and Payment 1 not — same rule togglePayment()
            // enforces, checked here as a single before/after comparison
            // since this endpoint submits the full desired state at once
            // rather than one toggle at a time.
            if ($payment2 !== null && $payment1 === null) {
                abort(422, 'Payment 1 must be completed before Payment 2 can be marked as paid.');
            }

            $attributes['paid_at'] = $payment1;
            $attributes['payment2_paid_at'] = $payment2;
        }

        $application->update($attributes);

        return (new MemberResource($application->fresh()))->withFiles();
    }

    /**
     * Flip one payment batch's state. Marking records today; unmarking clears
     * the date. Payment 2 can't be marked paid before Payment 1 is; the same
     * rule holds in reverse for revoking — Payment 1 can't be revoked while
     * Payment 2 is still paid, since money is unwound in the order it was
     * collected in.
     *
     * Transactional so the flip and the ledger row Application's `updated`
     * event writes for it (see Application::recordPaymentTransaction) either
     * both land or neither does — the same guarantee bulk() already gives
     * itself, just for a single member instead of a batch.
     *
     * $application is re-read with a row lock inside the transaction rather
     * than trusted from before it — two toggles on the same member arriving
     * together (a double-click, two officers on the same row) would
     * otherwise both read the same pre-transaction state, both decide the
     * same direction, and both flip it, each producing its own ledger row
     * for what was meant to be one change. Locking the row serializes the
     * second request behind the first, so it makes its decision from the
     * state the first one actually left behind.
     */
    public function togglePayment(Request $request, Application $application): MemberResource
    {
        Gate::authorize('members.payment');

        $data = $request->validate([
            'batch' => ['required', Rule::in([1, 2])],
        ]);

        $column = $data['batch'] === 2 ? 'payment2_paid_at' : 'paid_at';

        $application = DB::transaction(function () use ($application, $data, $column): Application {
            /** @var Application $locked */
            $locked = Application::whereKey($application->getKey())->lockForUpdate()->firstOrFail();

            $marking = $locked->{$column} === null;

            if ($data['batch'] === 2 && $marking && ! $locked->is_paid) {
                abort(422, 'Payment 1 must be completed before Payment 2 can be marked as paid.');
            }

            if ($data['batch'] === 1 && ! $marking && $locked->is_payment2_paid) {
                abort(422, 'Revoke Payment 2 before revoking Payment 1.');
            }

            $locked->update([$column => $marking ? now() : null]);

            return $locked;
        });

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

    /** The bulk `action` values that are payment writes rather than edit/delete ones. */
    private const PAYMENT_ACTIONS = [
        'payment1_paid', 'payment1_unpaid',
        'payment2_paid', 'payment2_unpaid',
        'both_paid', 'both_unpaid',
    ];

    /**
     * Columns bulk() actually needs across every action it supports: the
     * payment branches read/write paid_at + payment2_paid_at and denormalise
     * full_name/section/year_level onto each ledger row; delete/restore read
     * deleted_at for eligibility and full_name for the activity log. Nothing
     * here touches address, email, phone, student_id or either file path, so
     * a bulk run over hundreds of ids isn't hydrating (and transferring) full
     * rows just to read six columns off each one.
     */
    private const BULK_COLUMNS = [
        'id', 'membership_term_id', 'surname', 'given_name', 'middle_initial',
        'year_level', 'section', 'paid_at', 'payment2_paid_at', 'deleted_at',
    ];

    /**
     * Bulk payment / delete / restore over an explicit set of ids.
     *
     * The sequencing rule (Payment 2 needs Payment 1; revoking unwinds in the
     * reverse order) is enforced the same way a single skip already is:
     * members not eligible for the requested action are quietly excluded from
     * the ones actually written, and the client is told how many were
     * skipped — never a hard error over a whole batch just because part of
     * it wasn't eligible.
     */
    public function bulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
            'action' => ['required', Rule::in([...self::PAYMENT_ACTIONS, 'delete', 'restore'])],
        ]);

        // Payment actions and edit actions are separate permissions.
        Gate::authorize(in_array($data['action'], self::PAYMENT_ACTIONS, true) ? 'members.payment' : 'members.edit');

        // Atomic: a bulk run that fails partway must leave no member changed,
        // rather than some marked paid with no matching ledger/activity row.
        [$count, $updated] = DB::transaction(function () use ($data) {
            $members = Application::withTrashed()->whereIn('id', $data['ids'])->select(self::BULK_COLUMNS)->get();

            $updated = match ($data['action']) {
                'payment1_paid' => $this->bulkSetPayment($members->whereNull('paid_at'), 'paid_at', true),
                // Reverse-order rule: Payment 1 can't be revoked while
                // Payment 2 is still paid.
                'payment1_unpaid' => $this->bulkSetPayment(
                    $members->whereNotNull('paid_at')->whereNull('payment2_paid_at'), 'paid_at', false,
                ),
                // Payment 2 needs Payment 1 first — members still on Payment 1
                // are simply not eligible, same as "already paid" is skipped.
                'payment2_paid' => $this->bulkSetPayment(
                    $members->whereNotNull('paid_at')->whereNull('payment2_paid_at'), 'payment2_paid_at', true,
                ),
                'payment2_unpaid' => $this->bulkSetPayment($members->whereNotNull('payment2_paid_at'), 'payment2_paid_at', false),
                'both_paid' => $this->bulkSetBothPayments(
                    $members->reject(fn (Application $m): bool => $m->is_paid && $m->is_payment2_paid), true,
                ),
                'both_unpaid' => $this->bulkSetBothPayments(
                    $members->filter(fn (Application $m): bool => $m->is_paid || $m->is_payment2_paid), false,
                ),
                'delete' => $this->bulkDelete($members->whereNull('deleted_at')),
                'restore' => $this->bulkRestore($members->whereNotNull('deleted_at')),
            };

            return [$members->count(), $updated];
        });

        // `updated` lets the client patch the rows it already has in place
        // instead of re-fetching the whole page — populated for payment
        // actions only, since delete/restore change which page a row belongs on.
        return response()->json(['count' => $count, 'updated' => $updated]);
    }

    /** The combined payment state the client patches a row with after a bulk write. */
    private function paymentSnapshot(Application $member): array
    {
        return [
            'id' => $member->id,
            'isPayment1Paid' => $member->paid_at !== null,
            'payment1PaidAt' => optional($member->paid_at)->toIso8601String(),
            'isPayment2Paid' => $member->payment2_paid_at !== null,
            'payment2PaidAt' => optional($member->payment2_paid_at)->toIso8601String(),
        ];
    }

    /** @return array{string, float} [ledger kind, fee] for a payment column. */
    private function paymentKindAndFee(string $column): array
    {
        return $column === 'payment2_paid_at'
            ? [PaymentTransaction::PAYMENT_2, (float) config('icpep.membership_fee_2')]
            : [PaymentTransaction::PAYMENT_1, (float) config('icpep.membership_fee_1')];
    }

    /**
     * Marks every given (already-filtered-to-eligible) member paid or unpaid
     * on one payment column, in one batched UPDATE, then writes the
     * payment-ledger row each member's model event would otherwise have
     * written one at a time — as one bulk insert instead of N. Model events
     * don't fire on a mass update, so those rows are built here from the
     * still-in-memory pre-update snapshot, mirroring
     * Application::recordPaymentTransaction(). Payment History is the ledger
     * for this; it isn't also logged to the Activity Log.
     *
     * @param  Collection<int, Application>  $members
     * @return list<array{id: int, isPayment1Paid: bool, payment1PaidAt: ?string, isPayment2Paid: bool, payment2PaidAt: ?string}>
     */
    private function bulkSetPayment(Collection $members, string $column, bool $paid): array
    {
        if ($members->isEmpty()) {
            return [];
        }

        $now = Carbon::now();
        [$kind, $fee] = $this->paymentKindAndFee($column);
        $user = Auth::user();

        Application::withTrashed()->whereIn('id', $members->modelKeys())
            ->update([$column => $paid ? $now : null, 'updated_at' => $now]);

        $transactions = [];
        $updated = [];

        foreach ($members as $member) {
            // Pre-update snapshot: $member was loaded before the batched
            // UPDATE above, so this column here is still the member's old value.
            $previous = $member->{$column};
            [$action, $amount, $effectiveAt] = $paid
                // Unpaid -> paid.
                ? [PaymentTransaction::PAID, $fee, $now]
                // Paid -> unpaid. Stamped against the original payment date,
                // so the reversal lands in the period it cancels.
                : [PaymentTransaction::REVOKED, -$fee, $previous];

            $transactions[] = [
                'application_id' => $member->id,
                'membership_term_id' => $member->membership_term_id,
                'action' => $action,
                'kind' => $kind,
                'amount' => $amount,
                'effective_at' => $effectiveAt,
                'previous_effective_at' => $previous,
                'actor' => $user?->email,
                'actor_name' => $user?->name,
                'actor_role' => $user?->role?->value,
                'member_name' => $member->full_name,
                'section' => $member->section,
                'year_level' => $member->year_level,
                'created_at' => $now,
                'updated_at' => $now,
            ];

            // Reflected onto the in-memory model so the response reports the
            // member's combined payment state, not just the column this call
            // touched.
            $member->{$column} = $paid ? $now : null;
            $updated[] = $this->paymentSnapshot($member);
        }

        PaymentTransaction::insert($transactions);
        PaymentTransaction::bumpCacheVersion();

        return $updated;
    }

    /**
     * "Mark both payments paid/unpaid" in one operation. For "paid", brings
     * every given (already-filtered-to-not-fully-paid) member fully paid —
     * Payment 1 first, then Payment 2 — skipping whichever column a member
     * had already completed, so it isn't re-stamped with a fresh date. For
     * "unpaid", reverses whichever of the two is currently paid.
     *
     * @param  Collection<int, Application>  $members
     * @return list<array{id: int, isPayment1Paid: bool, payment1PaidAt: ?string, isPayment2Paid: bool, payment2PaidAt: ?string}>
     */
    private function bulkSetBothPayments(Collection $members, bool $paid): array
    {
        if ($members->isEmpty()) {
            return [];
        }

        $now = Carbon::now();
        $user = Auth::user();
        $transactions = [];
        $touchedIds = ['paid_at' => [], 'payment2_paid_at' => []];

        foreach ($members as $member) {
            foreach (['paid_at', 'payment2_paid_at'] as $column) {
                $currentlyPaid = $member->{$column} !== null;
                if ($currentlyPaid === $paid) {
                    continue; // already in the target state on this column
                }

                [$kind, $fee] = $this->paymentKindAndFee($column);
                $previous = $member->{$column};
                [$action, $amount, $effectiveAt] = $paid
                    ? [PaymentTransaction::PAID, $fee, $now]
                    : [PaymentTransaction::REVOKED, -$fee, $previous];

                $transactions[] = [
                    'application_id' => $member->id,
                    'membership_term_id' => $member->membership_term_id,
                    'action' => $action,
                    'kind' => $kind,
                    'amount' => $amount,
                    'effective_at' => $effectiveAt,
                    'previous_effective_at' => $previous,
                    'actor' => $user?->email,
                    'member_name' => $member->full_name,
                    'section' => $member->section,
                    'year_level' => $member->year_level,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $touchedIds[$column][] = $member->id;
                $member->{$column} = $paid ? $now : null;
            }
        }

        foreach ($touchedIds as $column => $ids) {
            if ($ids === []) {
                continue;
            }
            Application::withTrashed()->whereIn('id', $ids)
                ->update([$column => $paid ? $now : null, 'updated_at' => $now]);
        }

        if ($transactions !== []) {
            PaymentTransaction::insert($transactions);
            PaymentTransaction::bumpCacheVersion();
        }

        return $members->map(fn (Application $member): array => $this->paymentSnapshot($member))->values()->all();
    }

    /**
     * Soft-deletes every given (already-filtered-to-not-yet-deleted) member in
     * one batched UPDATE instead of N individual delete() calls, then writes
     * the activity-log row each one's `deleted` model event would otherwise
     * have written one at a time — same trade as bulkSetPayment() makes for
     * the ledger, and for the same reason: model events don't fire on a mass
     * update, so a loop of single deletes was previously N delete queries
     * plus N log inserts for what is, in substance, one write.
     *
     * @param  Collection<int, Application>  $members
     */
    private function bulkDelete(Collection $members): array
    {
        if ($members->isEmpty()) {
            return [];
        }

        $now = Carbon::now();
        Application::withTrashed()->whereIn('id', $members->modelKeys())
            ->update(['deleted_at' => $now, 'updated_at' => $now]);

        $this->bulkLogActivity($members, 'deleted', fn (Application $m): string => "Moved {$m->full_name} to Deleted");

        return [];
    }

    /**
     * Mirror of bulkDelete() for restoring — one batched UPDATE clearing
     * deleted_at, plus one bulk activity-log insert standing in for the
     * `restored` event.
     *
     * @param  Collection<int, Application>  $members
     */
    private function bulkRestore(Collection $members): array
    {
        if ($members->isEmpty()) {
            return [];
        }

        $now = Carbon::now();
        Application::withTrashed()->whereIn('id', $members->modelKeys())
            ->update(['deleted_at' => null, 'updated_at' => $now]);

        $this->bulkLogActivity($members, 'restored', fn (Application $m): string => "Restored {$m->full_name}");

        return [];
    }

    /**
     * One bulk insert of activity-log rows in place of the N individual
     * ActivityLog::record() calls Application's `deleted`/`restored` model
     * events would otherwise have made for a batch this size.
     *
     * @param  Collection<int, Application>  $members
     * @param  \Closure(Application): string  $describe
     */
    private function bulkLogActivity(Collection $members, string $action, \Closure $describe): void
    {
        $now = Carbon::now();
        $user = Auth::user();
        $ip = request()?->ip();

        ActivityLog::insert($members->map(fn (Application $member): array => [
            'actor' => $user?->email ?? 'Website',
            'actor_name' => $user?->name,
            'actor_role' => $user?->role?->value,
            'ip_address' => $ip,
            'action' => $action,
            'description' => $describe($member),
            'applicant' => $member->full_name,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all());
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
        /** @var FilesystemAdapter $disk */
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
        'Student ID', 'Full Name', 'Year Level', 'Section', 'Phone', 'Email',
        'Payment 1 Status', 'Payment 1 Paid At', 'Payment 2 Status', 'Payment 2 Paid At', 'Registered At',
    ];

    /**
     * Columns exportRow() (and the PDF view) actually read. An export is
     * every filtered row, unpaginated, so trimming this — skipping address,
     * birthday and both file paths, none of which any export format prints —
     * matters far more here than on the paginated list: a large roster's
     * export is otherwise hydrating (and transferring from the DB) full rows
     * for columns nothing downstream ever looks at.
     */
    private const EXPORT_SELECT_COLUMNS = [
        'id', 'membership_term_id', 'surname', 'given_name', 'middle_initial',
        'student_id', 'year_level', 'section', 'phone', 'email',
        'paid_at', 'payment2_paid_at', 'created_at',
    ];

    /** Human-readable labels for the Members List's payment filter, e.g. for the PDF header. */
    private const PAYMENT_FILTER_LABELS = [
        'p1_paid' => 'Payment 1 – Paid',
        'p1_unpaid' => 'Payment 1 – Unpaid',
        'p2_paid' => 'Payment 2 – Paid',
        'p2_unpaid' => 'Payment 2 – Unpaid',
        'both_paid' => 'Both Paid',
        'both_unpaid' => 'Both Unpaid',
        'p1_paid_p2_unpaid' => 'Payment 1 Paid, Payment 2 Unpaid',
        'p1_unpaid_p2_paid' => 'Payment 1 Unpaid, Payment 2 Paid',
    ];

    public function exportCsv(Request $request): StreamedResponse
    {
        $members = $this->exportRows($request);

        return response()->streamDownload(function () use ($members): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, self::EXPORT_COLUMNS);
            foreach ($members as $member) {
                fputcsv($out, array_map(self::escapeCsvFormula(...), $this->exportRow($member)));
            }
            fclose($out);
        }, $this->exportFilename($request, 'csv'), ['Content-Type' => 'text/csv']);
    }

    /**
     * Every field here traces back to the public application form, which
     * never restricted what characters a name or address could contain — so
     * a surname of "=cmd|..." reaching a spreadsheet unescaped would run as a
     * formula the moment an officer opens this CSV in Excel/Sheets, not
     * merely display oddly. A leading apostrophe is the standard fix: it
     * forces the cell to be read as text, and is itself invisible once
     * opened. Only cells actually starting with a formula-triggering
     * character pay for it — ordinary names and IDs pass through untouched.
     */
    private static function escapeCsvFormula(?string $value): string
    {
        // student_id is nullable (see the applications migration) — every
        // other exportRow() field is a guaranteed string, but fputcsv() has
        // always been fine printing null as empty, so this stays fine too.
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
        $members = $this->exportRows($request);

        return response()->streamDownload(function () use ($members): void {
            $writer = new XlsxWriter;
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
        return $this->applySort($this->filtered($request), $request)->select(self::EXPORT_SELECT_COLUMNS)->get();
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
            $member->is_payment2_paid ? 'Paid' : 'Unpaid',
            optional($member->payment2_paid_at)->toDateString() ?? '',
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
        if ($year = $request->input('year')) {
            $summary['Year Level'] = $year;
        }
        if ($payment = $request->input('payment')) {
            $summary['Payment'] = self::PAYMENT_FILTER_LABELS[$payment] ?? ucfirst($payment);
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

        // "Deleted members" is a 30-day window, not a permanent archive: past
        // that, a soft-deleted row stops showing up here (and under "with")
        // even though it stays in the table untouched. See
        // Application::DELETED_RETENTION_DAYS.
        $retentionCutoff = now()->subDays(Application::DELETED_RETENTION_DAYS);
        match ($request->input('trashed')) {
            'with' => $query->withTrashed()->where(function (Builder $q) use ($retentionCutoff): void {
                $q->whereNull('deleted_at')->orWhere('deleted_at', '>=', $retentionCutoff);
            }),
            'only' => $query->onlyTrashed()->where('deleted_at', '>=', $retentionCutoff),
            default => $query,
        };

        if ($class = $request->input('class')) {
            $query->inClass($class);
        }

        if ($year = $request->input('year')) {
            $query->yearLevel($year);
        }

        match ($request->input('payment')) {
            'p1_paid' => $query->whereNotNull('paid_at'),
            'p1_unpaid' => $query->whereNull('paid_at'),
            'p2_paid' => $query->whereNotNull('payment2_paid_at'),
            'p2_unpaid' => $query->whereNull('payment2_paid_at'),
            'both_paid' => $query->whereNotNull('paid_at')->whereNotNull('payment2_paid_at'),
            'both_unpaid' => $query->whereNull('paid_at')->whereNull('payment2_paid_at'),
            'p1_paid_p2_unpaid' => $query->whereNotNull('paid_at')->whereNull('payment2_paid_at'),
            // Should be empty once the sequencing rule holds everywhere — kept
            // as a filter option for parity/auditing rather than assumed
            // impossible, in case older data or a direct DB edit produced it.
            'p1_unpaid_p2_paid' => $query->whereNull('paid_at')->whereNotNull('payment2_paid_at'),
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
