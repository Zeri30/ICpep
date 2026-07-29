<?php

use App\Enums\Permission;
use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Give `schedule.manage` to the Assistant Secretary, whose stored row predates
 * the calendar being shared with them.
 *
 * The ability now sits in that role's defaults, so any chapter that has never
 * opened the Privileges panel for it picks the change up with no help. A role
 * that *has* been customized stores its complete ability list and
 * {@see \App\Models\RolePermission::resolve()} returns that list instead of the
 * defaults — so without this, the one role the change is for would be the one
 * role it failed to reach.
 *
 * This differs from {@see 2026_07_27_000002_backfill_schedule_permission} in
 * what the absence could have meant. There the ability did not exist when the
 * row was written, so filling it in could not override anyone. Here it did:
 * a row saved since the calendar shipped could, in principle, be an officer
 * having considered scheduling for the Assistant Secretary and left it off.
 * Overriding that is the intent — sharing the calendar is a decision the
 * chapter is making now, and it supersedes what the panel held before. It is
 * scoped to this one role and this one ability for exactly that reason; a
 * blanket top-up would revive abilities that were deliberately turned off.
 *
 * Whoever holds the panel can still take it away again afterwards, which is the
 * difference between a default this migration nudges and one it forces.
 */
return new class extends Migration
{
    public function up(): void
    {
        $ability = Permission::ManageSchedule->value;
        $role = UserRole::AssistantSecretary;

        $row = DB::table('role_permissions')->where('role', $role->value)->first();

        // No row means the role is still on the defaults, which now include it.
        if (! $row) {
            return;
        }

        $stored = json_decode($row->permissions, true);
        $stored = is_array($stored) ? $stored : [];

        if (in_array($ability, $stored, true)) {
            return;
        }

        DB::table('role_permissions')
            ->where('id', $row->id)
            ->update([
                'permissions' => json_encode([...$stored, $ability]),
                'updated_at' => now(),
            ]);
    }

    /**
     * Deliberately not reversed, on the same reasoning as the earlier backfill:
     * rolling back would take the calendar off the Assistant Secretary again,
     * and the resulting row would be indistinguishable from one where the
     * ability had been revoked on purpose.
     */
    public function down(): void
    {
        //
    }
};
