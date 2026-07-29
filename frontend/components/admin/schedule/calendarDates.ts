/* Date helpers for the calendar grid.

   Everything here works on plain "YYYY-MM-DD" strings, which is what the API
   sends (already converted to the organization's timezone). Comparing and
   grouping strings rather than Date objects is the whole trick: `new Date(
   "2026-11-03")` is parsed as UTC midnight and lands on November 2nd for anyone
   west of Greenwich, which would quietly file events under the wrong day. The
   only Dates built here are from explicit year/month/day numbers, which are
   local by construction and cannot slide. */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "2026-11-03" from a year, a 0-indexed month, and a day.
 *
 * Built through a Date so out-of-range arguments roll over correctly: the grid
 * pads January with month -1 and December with month 12, which string
 * arithmetic would render as "-00-" and "-13-".
 */
export function ymd(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's date, as a day in the given timezone rather than the viewer's. */
export function todayIn(timezone: string): string {
  // en-CA formats as YYYY-MM-DD, which is exactly the shape the API uses.
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Turn "2026-11-03" back into a local Date, for formatting only. */
function toLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Tuesday, November 3, 2026" */
export function formatLongDate(date: string): string {
  if (!date) return "—";
  return toLocalDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** "Nov 3" — for a dense list where the year is already obvious. */
export function formatShortDate(date: string): string {
  if (!date) return "—";
  return toLocalDate(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "November 2026" — the heading above the grid. */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** The months the header's picker offers, indexed as Date does — January is 0. */
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type GridDay = { date: string; day: number; inMonth: boolean };

/**
 * The six weeks a month grid draws: the days of the month, padded either side
 * with the neighbouring months' days so every week is complete.
 *
 * Always six rows, even when five would do, so the grid does not change height
 * as you page through the year — a calendar that resizes under the cursor makes
 * the next month's arrow move out from under it.
 */
export function monthGrid(year: number, month: number): GridDay[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: GridDay[] = [];

  // Day 0 of a month is the last day of the one before it.
  const daysInPrev = new Date(year, month, 0).getDate();
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    cells.push({ date: ymd(year, month - 1, day), day, inMonth: false });
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: ymd(year, month, day), day, inMonth: true });
  }

  for (let day = 1; cells.length < 42; day++) {
    cells.push({ date: ymd(year, month + 1, day), day, inMonth: false });
  }

  return cells;
}
