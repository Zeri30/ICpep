<?php

namespace App\Enums;

/**
 * Fine-grained abilities the admin is authorized against. Roles are mapped to a
 * set of these (see UserRole::permissions), and each one is registered as a
 * Laravel Gate (see AppServiceProvider) so routes, controllers and the frontend
 * all authorize against the same vocabulary.
 *
 * Adding a capability is a matter of adding a case here and granting it to the
 * roles that should have it — nothing else needs to change.
 */
enum Permission: string
{
    /** Reach the Members module and read member records. */
    case ViewMembers = 'members.view';

    /** Create / edit / delete / restore member records (non-financial data). */
    case EditMembers = 'members.edit';

    /** Change a member's payment status (paid / unpaid) — a financial action. */
    case UpdatePayment = 'members.payment';

    /** Reach the financial modules (Payment History, revenue figures). */
    case AccessFinance = 'finance.view';

    /** Reach User Management and manage administrator accounts. */
    case ManageUsers = 'users.manage';

    /**
     * Roll the membership cycle over: create a semester's membership list, make
     * one the current list, and open or close the public registration form.
     */
    case ManageTerms = 'terms.manage';

    public function label(): string
    {
        return match ($this) {
            self::ViewMembers => 'View members',
            self::EditMembers => 'Edit members',
            self::UpdatePayment => 'Update payment status',
            self::AccessFinance => 'Access financial modules',
            self::ManageUsers => 'Manage administrator accounts',
            self::ManageTerms => 'Manage membership lists and registration',
        };
    }
}
