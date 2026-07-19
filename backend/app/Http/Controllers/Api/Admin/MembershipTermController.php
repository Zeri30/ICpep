<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MembershipTermResource;
use App\Models\ActivityLog;
use App\Models\MembershipTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The membership lists — one per semester of a school year.
 *
 * Reading is open to anyone who can see members (the list selector is part of
 * the Members module). Creating a list, and choosing which one is current, is
 * the semester rollover and needs terms.manage.
 */
class MembershipTermController extends Controller
{
    /** Every list, current one first, with member counts for the selector. */
    public function index(): AnonymousResourceCollection
    {
        return MembershipTermResource::collection(
            MembershipTerm::withCount('applications')->ordered()->get(),
        );
    }

    /**
     * Create a semester's membership list.
     *
     * The new list is empty — creating it never moves or copies existing
     * records. Making it current is a separate flag rather than implicit,
     * because a list is often created ahead of the semester it is for; a
     * created-but-not-current list simply sits there until it is activated.
     */
    public function store(Request $request): JsonResponse
    {
        Gate::authorize('terms.manage');

        $data = $request->validate([
            'schoolYearFrom' => ['required', 'integer', 'min:2000', 'max:2100'],
            'schoolYearTo' => ['required', 'integer', 'min:2000', 'max:2101'],
            'semester' => ['required', 'integer', Rule::in([1, 2])],
            'setCurrent' => ['sometimes', 'boolean'],
        ]);

        if ($data['schoolYearTo'] !== $data['schoolYearFrom'] + 1) {
            throw ValidationException::withMessages([
                'schoolYearTo' => 'A school year must span two consecutive years (e.g. 2026–2027).',
            ]);
        }

        $exists = MembershipTerm::where('school_year_from', $data['schoolYearFrom'])
            ->where('semester', $data['semester'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'semester' => 'That membership list already exists.',
            ]);
        }

        // The cycle only moves forward. Back-dating a list is almost always a
        // typo in the year or semester, and acting on it would either create a
        // second list for a semester already closed or — if activated — send new
        // applicants into a historical roster. Enforced here and not only in the
        // form, so it holds for any client.
        $current = MembershipTerm::current();
        $proposed = MembershipTerm::sequenceFor($data['schoolYearFrom'], $data['semester']);

        if ($current && $proposed < $current->sequence) {
            throw ValidationException::withMessages([
                'schoolYearFrom' => "A new membership list cannot start before the current one ({$current->label}).",
            ]);
        }

        $term = MembershipTerm::create([
            'school_year_from' => $data['schoolYearFrom'],
            'school_year_to' => $data['schoolYearTo'],
            'semester' => $data['semester'],
        ]);

        ActivityLog::record('term_created', "Created membership list {$term->label}");

        if ($data['setCurrent'] ?? false) {
            $this->activateTerm($term);
        }

        return response()->json(
            new MembershipTermResource($term->fresh()->loadCount('applications')),
            201,
        );
    }

    /**
     * Make an existing list the current one. Every application submitted from
     * here on is filed under it; the list it replaces becomes a historical
     * record and stops receiving registrations.
     */
    public function activate(MembershipTerm $term): MembershipTermResource
    {
        Gate::authorize('terms.manage');

        $this->activateTerm($term);

        return new MembershipTermResource($term->fresh()->loadCount('applications'));
    }

    private function activateTerm(MembershipTerm $term): void
    {
        if ($term->is_current) {
            return;
        }

        $previous = MembershipTerm::current();

        $term->makeCurrent();

        $from = $previous ? " (was {$previous->label})" : '';
        ActivityLog::record('term_activated', "New registrations now go to {$term->label}{$from}");
    }
}
