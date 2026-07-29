<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Repair rows written while `role_permissions` stored only the *editable*
 * abilities.
 *
 * Under that scheme an ability missing from a row meant "leave it at the role's
 * default", because the panel could not change it. Once `members.view` became
 * editable the same absence started to read as "revoked", which would have
 * quietly closed the Members module for every role already customized — the
 * President's saved row was an empty array, and would have gone from
 * view + terms down to terms alone.
 *
 * So each existing row gains back the defaults it never had a say over. Only
 * `members.edit` and `members.payment` were editable when those rows were
 * written, so everything else in the role's defaults was implied rather than
 * omitted. New rows store the full set (see RolePermission::grant), which is
 * what stops this recurring.
 */
return new class extends Migration
{
    /** The abilities the panel could actually change when the old rows were written. */
    private const LEGACY_EDITABLE = ['members.edit', 'members.payment'];

    public function up(): void
    {
        foreach (DB::table('role_permissions')->get() as $row) {
            $role = UserRole::tryFrom($row->role);

            if (! $role) {
                continue;
            }

            $stored = json_decode($row->permissions, true);
            $stored = is_array($stored) ? $stored : [];

            $implied = array_diff(
                array_map(static fn ($p): string => $p->value, $role->defaultPermissions()),
                self::LEGACY_EDITABLE,
            );

            DB::table('role_permissions')
                ->where('id', $row->id)
                ->update([
                    'permissions' => json_encode(array_values(array_unique([...$stored, ...$implied]))),
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Not reversible in any meaningful sense: the pre-repair rows are
     * indistinguishable from a deliberate revocation, so undoing this would
     * re-introduce the very ambiguity it exists to remove.
     */
    public function down(): void
    {
        //
    }
};
