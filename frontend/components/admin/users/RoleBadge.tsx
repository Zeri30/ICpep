"use client";

/* A role, shown as a coloured pill. Reusable wherever a role is displayed —
   the colour and the glyph come from lib/roleFamily, which is the only place
   either is decided.

   The colour is the role's *family*, not the role, and the name is written out
   beside it: with seventeen roles the hue narrows it to a branch of the
   organization and the label says which one. A shield is added to the roles that
   can reach User Management, which is worth calling out on the account list
   itself — read from the live privilege matrix, so it follows the Privileges
   panel rather than a list kept here. */

import { ShieldCheck } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { familyStyle, findRole } from "@/lib/roleFamily";

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
  const style = familyStyle(option?.family);
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.badge} ${className}`}
      // Names the branch, since the colour cannot be read out and the family is
      // otherwise only implied by the hue.
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
