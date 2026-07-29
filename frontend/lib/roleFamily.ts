/* The one place a role's colour is decided.
 *
 * There are seventeen roles. Seventeen colours a person can actually tell apart
 * is not a thing, so the colour says which *branch* of the organization the role
 * belongs to — executive, secretariat, finance, communications, governance,
 * technical — and the label says which role. Six hues is a set you can learn;
 * seventeen is a set you look up every time.
 *
 * The families are decided in the backend (App\Enums\RoleFamily) and arrive with
 * every role in `meta.roles`, so a role added there is already classified by the
 * time it reaches the UI and there is nothing here to keep in step. What lives
 * here is only the presentation of a family: its hue and its glyph.
 *
 * Accessibility, since a colour-coded badge is exactly the thing that goes wrong
 * for a reader who cannot see the colour:
 *  - every family also has its own icon, and the role's name is written out in
 *    the badge, so the colour is the third way of telling them apart and never
 *    the only one;
 *  - the text shades are 400-level on a #0a0a0a card, which lands between 6.7:1
 *    (red) and 12:1 (amber) — AA at this size with room to spare, most of them
 *    AAA.
 */

import {
  Crown,
  Landmark,
  Megaphone,
  NotebookPen,
  Wallet,
  Code,
  type LucideIcon,
} from "lucide-react";
import type { RoleOption } from "@/lib/adminApi";

/** Mirrors App\Enums\RoleFamily. */
export type RoleFamily =
  | "executive"
  | "secretariat"
  | "finance"
  | "communications"
  | "governance"
  | "technical";

export type RoleFamilyStyle = {
  /** Border / background / text classes for a badge on the dark admin theme. */
  badge: string;
  /** Text colour on its own, for places that want the hue without the pill. */
  text: string;
  /** The family's glyph — what carries the distinction without colour. */
  icon: LucideIcon;
};

const STYLES: Record<RoleFamily, RoleFamilyStyle> = {
  executive: {
    badge: "border-red-400/30 bg-red-400/10 text-red-400",
    text: "text-red-400",
    icon: Crown,
  },
  secretariat: {
    badge: "border-blue-400/30 bg-blue-400/10 text-blue-400",
    text: "text-blue-400",
    icon: NotebookPen,
  },
  finance: {
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    text: "text-emerald-400",
    icon: Wallet,
  },
  communications: {
    badge: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    text: "text-amber-400",
    icon: Megaphone,
  },
  governance: {
    badge: "border-violet-400/30 bg-violet-400/10 text-violet-400",
    text: "text-violet-400",
    icon: Landmark,
  },
  technical: {
    badge: "border-cyan-400/30 bg-cyan-400/10 text-cyan-400",
    text: "text-cyan-400",
    icon: Code,
  },
};

/**
 * Where an account with no role, or one whose family the UI does not recognize,
 * lands. Neutral on purpose: an unknown role must look unclassified rather than
 * borrow a branch it may not belong to.
 */
export const UNKNOWN_ROLE_STYLE: RoleFamilyStyle = {
  badge: "border-line bg-white/5 text-secondary-foreground",
  text: "text-secondary-foreground",
  icon: Landmark,
};

export function familyStyle(family: string | null | undefined): RoleFamilyStyle {
  return (family && STYLES[family as RoleFamily]) || UNKNOWN_ROLE_STYLE;
}

/**
 * Look a role value up in `meta.roles`. Returns undefined for a null role, and
 * for a value the backend no longer sends — a stale row for a role that has
 * since been removed, which should read as unclassified rather than crash.
 */
export function findRole(roles: RoleOption[], role: string | null | undefined): RoleOption | undefined {
  return role ? roles.find((r) => r.value === role) : undefined;
}

export type RoleGroup = { family: string; label: string; roles: RoleOption[] };

/**
 * The roles bucketed under their family heading, in the heading order the
 * backend sends — roughly down the organization chart. Used to build the
 * `<optgroup>`s in the role selects, where seventeen flat options would be a
 * scroll rather than a choice.
 *
 * The heading order comes from `meta.roleFamilies` rather than from the order the
 * roles arrive in, which would put whichever family the first role belongs to at
 * the top — Technical, since the Programming Team leads the role list.
 *
 * A family with no roles is dropped, and a role whose family is not in the list
 * is still shown under a heading of its own at the end: an unclassified role
 * belongs in the select more than it belongs in a tidy grouping.
 */
export function groupByFamily(
  roles: RoleOption[],
  families: { value: string; label: string }[],
): RoleGroup[] {
  const groups: RoleGroup[] = families
    .map((f) => ({ family: f.value, label: f.label, roles: roles.filter((r) => r.family === f.value) }))
    .filter((g) => g.roles.length > 0);

  const placed = new Set(groups.flatMap((g) => g.roles.map((r) => r.value)));

  for (const role of roles) {
    if (placed.has(role.value)) continue;
    const existing = groups.find((g) => g.family === role.family);
    if (existing) existing.roles.push(role);
    else groups.push({ family: role.family, label: role.familyLabel || "Other", roles: [role] });
  }

  return groups;
}
