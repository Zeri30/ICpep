"use client";

/* A role, shown as a neutral pill. Reusable wherever a role is displayed —
   the glyph comes from lib/roleFamily, which is the only place it's decided.

   The glyph is the role's *family*, not the role, and the name is written out
   beside it: with seventeen roles the icon narrows it to a branch of the
   organization and the label says which one. Colour is deliberately not used
   to tell families apart. A shield is added to the roles that can reach User
   Management, which is worth calling out on the account list itself — read
   from the live privilege matrix, so it follows the Privileges panel rather
   than a list kept here. */

import { ShieldCheck } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { familyStyle, findRole, UNKNOWN_ROLE_STYLE } from "@/lib/roleFamily";

export default function RoleBadge({
  role,
  /** The label to fall back on when the role is not one the backend still sends. */
  label,
  className = "",
}: {
  role: string | null;
  label?: string | null;
  className?: string;
}) {
  const { meta } = useAdmin();
  const option = findRole(meta.roles, role);
  // Icon still comes from the role's family (a shape, not a colour); the badge
  // itself is neutral for every role — the family is no longer told apart by hue.
  const Icon = familyStyle(option?.family).icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${UNKNOWN_ROLE_STYLE.badge} ${className}`}
      // Names the branch, since the family is otherwise only implied by the icon.
      title={option ? `${option.label} — ${option.familyLabel}` : undefined}
    >
      <Icon size={12} className="shrink-0" aria-hidden />
      {option?.label ?? label ?? role ?? "—"}
      {option?.managesUsers && (
        <ShieldCheck size={12} className="shrink-0" aria-label="Manages administrator accounts" />
      )}
    </span>
  );
}
