<?php

namespace App\Enums;

use App\Http\Controllers\Api\Admin\RolePermissionController;
use App\Models\RolePermission;

/**
 * Fine-grained abilities the admin is authorized against. Roles are mapped to a
 * set of these (see UserRole::permissions), and each one is registered as a
 * Laravel Gate (see AppServiceProvider) so routes, controllers and the frontend
 * all authorize against the same vocabulary.
 *
 * Adding a capability is a matter of adding a case here, giving it a label,
 * description and group for the Privileges panel, and granting it to the roles
 * that should have it by default — nothing else needs to change.
 */
enum Permission: string
{
    /** Reach the Members module and read member records. */
    case ViewMembers = 'members.view';

    /** Create / edit / delete / restore member records (non-financial data). */
    case EditMembers = 'members.edit';

    /** Change a member's payment status (paid / unpaid) — a financial action. */
    case UpdatePayment = 'members.payment';

    /** Open Payment History and read the payment ledger. */
    case AccessFinance = 'finance.view';

    /**
     * See the money on the dashboard — the revenue totals and the payment
     * summary.
     *
     * Deliberately separate from {@see self::AccessFinance}. The two used to be
     * one ability, which meant letting a role read the ledger also handed them
     * the chapter's takings, and there was no way to give one without the
     * other. The secretariat is exactly that case: they keep the records and
     * need the ledger, but the money is the treasury's business.
     *
     * Independent rather than requiring the ledger, because the reverse is a
     * real position too — an executive who should see the totals without
     * reading every line of who has paid.
     */
    case ViewRevenue = 'finance.revenue';

    /** Reach User Management and manage administrator accounts. */
    case ManageUsers = 'users.manage';

    /**
     * Roll the membership cycle over: create a semester's membership list, make
     * one the current list, and open or close the public registration form.
     */
    case ManageTerms = 'terms.manage';

    /**
     * Schedule events on the organization's calendar — create, edit and delete.
     * Reading the calendar needs nothing: every officer sees it.
     */
    case ManageSchedule = 'schedule.manage';

    public function label(): string
    {
        return match ($this) {
            self::ViewMembers => 'View members',
            self::EditMembers => 'Edit members',
            self::UpdatePayment => 'Update payment status',
            self::AccessFinance => 'Open Payment History',
            self::ViewRevenue => 'See revenue figures',
            self::ManageUsers => 'Manage administrator accounts',
            self::ManageTerms => 'Manage membership lists and registration',
            self::ManageSchedule => 'Schedule events on the calendar',
        };
    }

    /**
     * Plain-language explanation of what ticking this grants, shown under the
     * label in the Privileges panel. Written for the officer doing the ticking,
     * so it names the screens and buttons they would see.
     */
    public function description(): string
    {
        return match ($this) {
            self::ViewMembers => 'Open the Members List and read member records.',
            self::EditMembers => 'Add, edit, delete and restore members. Does not include payment status.',
            self::UpdatePayment => 'Mark members paid or unpaid, individually or in bulk.',
            self::AccessFinance => 'Open Payment History and read the record of who has paid. Does not show the revenue totals.',
            self::ViewRevenue => 'See the revenue figures and payment summary on the dashboard. Does not open Payment History.',
            self::ManageUsers => 'Open User Management: create accounts, reset passwords and set privileges.',
            self::ManageTerms => "Create each semester's membership list, switch the current one, and open or close the public registration form.",
            self::ManageSchedule => 'Add, edit and delete events on Schedules. Every officer can already read it — this is the ability to change it.',
        };
    }

    /** The heading this ability sits under in the Privileges panel. */
    public function group(): string
    {
        return match ($this) {
            self::ViewMembers, self::EditMembers, self::UpdatePayment => 'Members',
            self::AccessFinance, self::ViewRevenue => 'Finance',
            self::ManageSchedule => 'Scheduling',
            self::ManageUsers, self::ManageTerms => 'Administration',
        };
    }

    /**
     * May the Privileges panel grant or revoke this ability from a role?
     *
     * Every ability is now the Programming Team's to grant or revoke. Spelled
     * out case by case rather than as a bare `true` so that an ability added
     * later starts fixed until someone deliberately lists it — the safer default
     * for a method that decides what the panel may hand out.
     *
     * `users.manage` is the dangerous one: whoever holds it can open this very
     * panel and grant themselves everything else, so granting it is effectively
     * granting all of it. {@see RolePermissionController} refuses any change
     * that would take it away from the officer making it or leave no active
     * account holding it at all — there is no way back in from there.
     */
    public function isEditable(): bool
    {
        return match ($this) {
            self::ViewMembers, self::EditMembers, self::UpdatePayment,
            self::AccessFinance, self::ViewRevenue, self::ManageUsers,
            self::ManageTerms, self::ManageSchedule => true,
            // Unreachable today, and deliberately kept: a case added later falls
            // here and stays out of the panel until someone lists it above.
            default => false,
        };
    }

    /**
     * The ability that must be held alongside this one for it to mean anything,
     * if any.
     *
     * Reaching the Members module at all is gated on `members.view` — including
     * the write routes (see routes/admin.php) — so editing members or changing
     * payment status without it would be a grant the API refuses to honour. The
     * panel greys those rows out while View is off, and
     * {@see RolePermission::resolve()} drops them on read, so the matrix can
     * never claim an ability the routes would deny.
     */
    public function requires(): ?self
    {
        return match ($this) {
            self::EditMembers, self::UpdatePayment => self::ViewMembers,
            default => null,
        };
    }

    /** @return list<string> the raw values, for validation rules. */
    public static function values(): array
    {
        return array_map(fn (self $p): string => $p->value, self::cases());
    }

    /**
     * The full catalog the Privileges panel renders, in declaration order.
     *
     * @return list<array{value:string,label:string,description:string,group:string,editable:bool,requires:?string}>
     */
    public static function catalog(): array
    {
        return array_map(fn (self $p): array => [
            'value' => $p->value,
            'label' => $p->label(),
            'description' => $p->description(),
            'group' => $p->group(),
            'editable' => $p->isEditable(),
            'requires' => $p->requires()?->value,
        ], self::cases());
    }
}
