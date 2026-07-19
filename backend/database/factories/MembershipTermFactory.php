<?php

namespace Database\Factories;

use App\Models\MembershipTerm;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MembershipTerm>
 */
class MembershipTermFactory extends Factory
{
    protected $model = MembershipTerm::class;

    public function definition(): array
    {
        $from = 2026;

        return [
            'school_year_from' => $from,
            'school_year_to' => $from + 1,
            'semester' => 1,
            'is_current' => false,
        ];
    }

    /** A specific school year and semester, e.g. term(2025, 2) → 2025–2026 Sem 2. */
    public function term(int $from, int $semester): static
    {
        return $this->state(fn (): array => [
            'school_year_from' => $from,
            'school_year_to' => $from + 1,
            'semester' => $semester,
        ]);
    }

    /** The list accepting new registrations. */
    public function current(): static
    {
        return $this->state(fn (): array => ['is_current' => true]);
    }
}
