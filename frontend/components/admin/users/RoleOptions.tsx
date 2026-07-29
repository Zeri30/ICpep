"use client";

/* The `<option>`s for a role select, grouped under their family heading.

   Seventeen roles in one flat list is a scroll rather than a choice: you cannot
   see where the executives end and the teams begin, and two roles with similar
   names sit nowhere near each other. Grouped, picking a role is a matter of
   finding the branch first. The grouping and its order come from the backend
   (App\Enums\RoleFamily), so this renders a classification rather than deciding
   one.

   A bare fragment of options, so the parent owns the select and any leading
   option of its own — "All roles" on the filter, for instance. */

import { useAdmin } from "@/components/admin/AdminProvider";
import { groupByFamily } from "@/lib/roleFamily";
import type { RoleOption } from "@/lib/adminApi";

export default function RoleOptions({ roles }: { roles: RoleOption[] }) {
  // The roles come from the caller (the account form holds them in its state),
  // the heading order from the shell — see groupByFamily.
  const { meta } = useAdmin();

  return (
    <>
      {groupByFamily(roles, meta.roleFamilies).map((group) => (
        <optgroup key={group.family} label={group.label}>
          {group.roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
