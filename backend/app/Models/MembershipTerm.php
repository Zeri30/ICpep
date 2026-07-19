<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * One semester's membership list — an independent roster for a school year and
 * semester (e.g. 2026–2027 Semester 1).
 *
 * Exactly one term is `is_current` at a time; that is the list every new
 * application is filed under. Every other term is a historical record: still
 * fully readable in the admin, but closed to new registrations. Nothing reads
 * "the newest term" — the destination is always whichever row is current, so
 * creating next semester's list ahead of time is safe.
 *
 * @property int $school_year_from
 * @property int $school_year_to
 * @property int $semester
 * @property bool $is_current
 */
class MembershipTerm extends Model
{
    use HasFactory;

    protected $fillable = [
        'school_year_from',
        'school_year_to',
        'semester',
        'is_current',
    ];

    protected $casts = [
        'school_year_from' => 'integer',
        'school_year_to' => 'integer',
        'semester' => 'integer',
        'is_current' => 'boolean',
    ];

    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    /** The list new applications are filed under, if one has been set. */
    public static function current(): ?self
    {
        return static::where('is_current', true)->first();
    }

    /**
     * The list an admin request is asking about: an explicit `term` id if it
     * names one that exists, otherwise the current list.
     *
     * Falling back rather than 404-ing keeps a stale id in a bookmarked URL
     * from breaking the module, and returns null only on a database with no
     * terms at all — where the callers skip scoping and show everything.
     */
    public static function resolve(int|string|null $id): ?self
    {
        return ($id ? static::find($id) : null) ?? static::current();
    }

    /**
     * Make this the one list accepting registrations.
     *
     * Demotion and promotion happen in a single transaction so there is never a
     * moment with two current terms (which would make the destination of an
     * in-flight application ambiguous) or zero.
     */
    public function makeCurrent(): void
    {
        DB::transaction(function (): void {
            static::where('is_current', true)
                ->whereKeyNot($this->getKey())
                ->update(['is_current' => false]);

            $this->forceFill(['is_current' => true])->save();
        });
    }

    /**
     * A sortable stamp for "which semester is later", e.g. 2026 Sem 2 → 20262.
     * Comparing these is how the rollover refuses to move backwards.
     */
    public function getSequenceAttribute(): int
    {
        return static::sequenceFor($this->school_year_from, $this->semester);
    }

    public static function sequenceFor(int $schoolYearFrom, int $semester): int
    {
        return $schoolYearFrom * 10 + $semester;
    }

    /** "2026–2027 Semester 1" — the label shown in the selector. */
    public function getLabelAttribute(): string
    {
        return "{$this->school_year_from}–{$this->school_year_to} Semester {$this->semester}";
    }

    /**
     * Newest first, with the current list always at the top regardless of when
     * it was created — an admin may create a future term while an older one is
     * still the active one.
     *
     * @param  Builder<MembershipTerm>  $query
     * @return Builder<MembershipTerm>
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query
            ->orderByDesc('is_current')
            ->orderByDesc('school_year_from')
            ->orderByDesc('semester');
    }
}
