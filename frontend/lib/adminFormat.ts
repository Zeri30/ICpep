/* Shared date formatting for the admin, matching the Filament "M j, Y g:i A"
   style (e.g. "Jul 8, 2026 10:07 AM"). */

const DATETIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", DATETIME);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", DATE);
}

/** The cap every unread badge in the admin renders past — a sidebar nav item
    or a "New" row count that just says "9+" reads as "a lot", the same
    information a precise "47" would give at a glance, without the badge
    itself growing wide enough to unbalance the row it sits in. */
const BADGE_CAP = 9;

export function formatBadgeCount(count: number): string {
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}
