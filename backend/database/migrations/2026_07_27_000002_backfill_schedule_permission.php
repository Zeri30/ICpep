<?php

use App\Enums\Permission;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Give `schedule.manage` to the Secretary, whose saved row predates the ability
 * existing.
 *
 * A role customized from the Privileges panel stores its complete ability list,
 * and {@see \App\Models\RolePermission::resolve()} returns that list instead of
 * the defaults declared in code. That is the point — an officer's deliberate
 * choice should not be overwritten by a later edit to the defaults. But it also
 * means a role that has ever been customized never receives an ability added
 * afterwards: the Secretary's row was written when the enum had six cases, so
 * the Calendar arrived switched off for the one role that owns it, with no
 * error to explain why.
 *
 * Absence cannot mean "revoked" here, because there was nothing to revoke when
 * the row was saved — so filling it in cannot override anyone's decision.
 * Scoped to this one ability for exactly that reason: a blanket "top every row
 * up to its defaults" would resurrect abilities that *were* deliberately turned
 * off.
 *
 * Any future ability needs its own migration on the same reasoning — there is
 * no general fix as long as a stored row is the whole truth for a role.
 */
return new class extends Migration
{
    /**
     * The roles that held the ability by default the day this was written.
     *
     * Spelled out rather than read back from {@see UserRole::defaultPermissions()},
     * because that method is live code and this is history. Asking it at run
     * time would re-aim a shipped migration every time the defaults changed —
     * and the reasoning above, which is what makes this safe, is true of these
     * roles and no others. A role that gains the ability later needs its own
     * migration with its own argument for why filling it in is not an override.
     */
    private const ROLES = ['secretary'];

    public function up(): void
    {
        $ability = Permission::ManageSchedule->value;

        $rows = DB::table('role_permissions')->whereIn('role', self::ROLES)->get();

        foreach ($rows as $row) {
            $stored = json_decode($row->permissions, true);
            $stored = is_array($stored) ? $stored : [];

            if (in_array($ability, $stored, true)) {
                continue;
            }

            DB::table('role_permissions')
                ->where('id', $row->id)
                ->update([
                    'permissions' => json_encode([...$stored, $ability]),
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Deliberately not reversed. Rolling back would take the Calendar away from
     * the Secretary again, and the resulting row would be indistinguishable
     * from one where the ability had been revoked on purpose.
     */
    public function down(): void
    {
        //
    }
};
