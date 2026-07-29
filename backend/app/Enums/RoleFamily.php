<?php

namespace App\Enums;

/**
 * The branch of the organization a {@see UserRole} belongs to.
 *
 * This exists because the role list outgrew being shown as a flat list of
 * seventeen equal things. It does two jobs, both of them presentation:
 *
 *  - the admin colours a role badge by family, since seventeen genuinely
 *    distinguishable colours is not a thing that exists — six are;
 *  - the role selects group their options under these headings, so picking a
 *    role is a matter of finding the right branch first.
 *
 * Deliberately *not* an authorization concept. Two roles in the same family can
 * hold completely different abilities (the Secretary and the Documentation Team
 * Head do), and nothing may infer a permission from a family — that stays with
 * {@see UserRole::permissions()} alone. The families are how the organization
 * describes itself, not how it is gated.
 *
 * Declaration order is the order the headings appear in a grouped select, so it
 * reads roughly down the organization chart.
 */
enum RoleFamily: string
{
    /** The officers who run the chapter — the President, VPs and the Adviser. */
    case Executive = 'executive';

    /** The keepers of the records and the calendar. */
    case Secretariat = 'secretariat';

    /** The treasury. */
    case Finance = 'finance';

    /** Everyone whose work is the chapter talking to people. */
    case Communications = 'communications';

    /** The board — oversight rather than day-to-day work. */
    case Governance = 'governance';

    /** The build-and-run teams: programming, and the activity teams beside it. */
    case Technical = 'technical';

    public function label(): string
    {
        return match ($this) {
            self::Executive => 'Executive',
            self::Secretariat => 'Secretariat',
            self::Finance => 'Finance',
            self::Communications => 'Communications',
            self::Governance => 'Governance',
            self::Technical => 'Technical',
        };
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(fn (self $f): string => $f->value, self::cases());
    }

    /**
     * The families in the order their headings should appear, for the grouped
     * role selects.
     *
     * Sent as its own list rather than left to be inferred from the order of the
     * roles: doing that puts whichever family the first role happens to belong to
     * at the top, which is how the Technical heading ended up above Executive —
     * the Programming Team is simply declared first in {@see UserRole}. The order
     * of the headings is a decision, and it is made here.
     *
     * @return list<array{value:string,label:string}>
     */
    public static function options(): array
    {
        return array_map(fn (self $f): array => [
            'value' => $f->value,
            'label' => $f->label(),
        ], self::cases());
    }
}
