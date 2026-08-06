<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Backstops MembershipTerm::makeCurrent()'s "at most one current term"
 * invariant at the database level, on top of the transaction that already
 * enforces it at the application level.
 *
 * The transaction alone has a real gap: it makes each individual activation
 * atomic, but doesn't serialize two *concurrent* activations of two
 * *different* terms. Under READ COMMITTED, term B's demote-everyone-else
 * statement can affect zero rows (because term A's transaction already
 * demoted the prior term and committed first), and B's own promote statement
 * then runs unconditionally — leaving both A and B marked `is_current = true`
 * at once. A partial unique index makes that second promote fail loudly
 * (a constraint violation makeCurrent() catches and resolves — see that
 * method) instead of silently succeeding.
 *
 * A partial index rather than a table-wide unique constraint, because
 * `is_current` is `false` for every historical term — a plain unique index
 * on the column would allow at most one `false` row in the whole table,
 * which is not the rule being enforced here.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            'CREATE UNIQUE INDEX membership_terms_one_current_unique '
            .'ON membership_terms (is_current) '
            .'WHERE is_current'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS membership_terms_one_current_unique');
    }
};
