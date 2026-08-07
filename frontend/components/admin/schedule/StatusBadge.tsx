"use client";

/* The two badges an event wears: what became of it, and when it is.

   They are separate on purpose. A date that has passed says the event was due,
   not that it happened — so "3 days ago" and "Done" are different claims, and
   an event can carry the first while still waiting for the second. That gap is
   what `needsStatusUpdate` marks. */

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import type { ScheduledEvent } from "@/lib/adminTypes";

/**
 * What each outcome looks like wherever it appears — the badge below, the
 * modal's status control, the list's filter. One colour and one word per
 * status, in one place, so a green "Done" cannot come to mean two things.
 *
 * `badge` is the bordered pill; `active` is the flatter fill the segmented
 * controls use for the option currently chosen.
 */
export const STATUS_TONES = {
  scheduled: {
    label: "Scheduled",
    Icon: CircleDot,
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    active: "bg-sky-500/15 text-sky-300",
  },
  done: {
    label: "Done",
    Icon: CheckCircle2,
    badge: "border-green-500/30 bg-green-500/10 text-green-400",
    active: "bg-green-500/15 text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    Icon: XCircle,
    badge: "border-red-500/30 bg-red-500/10 text-red-400",
    active: "bg-red-500/15 text-red-400",
  },
} as const satisfies Record<
  ScheduledEvent["status"],
  { label: string; Icon: typeof CircleDot; badge: string; active: string }
>;

/**
 * The order every control offers them in: the state an event starts in, then
 * the two ways it can end. A tuple rather than Object.keys so the order is
 * something the code states rather than something it inherits.
 */
export const STATUS_ORDER = ["scheduled", "done", "cancelled"] as const;

/**
 * The shape every small marker in the schedule wears: the badges below, the
 * calendar's outcome filter, the modal's unsaved marker. Exported so they stay
 * one object rather than three long class strings that drift apart silently.
 */
export const pill =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function StatusBadge({ event }: { event: ScheduledEvent }) {
  const { badge, Icon } = STATUS_TONES[event.status];
  return (
    <span className={`${pill} ${badge}`}>
      {/* The server's own word for it, not the local label — they agree today,
          and if they ever stop, the badge should say what the API said. */}
      <Icon size={11} /> {event.statusLabel}
    </span>
  );
}

/**
 * How far off the event is. Emphasised on the day itself — that is the one
 * reading anybody scans the calendar for.
 */
export function TimingBadge({ event }: { event: ScheduledEvent }) {
  const cls =
    event.timing === "today"
      ? "border-primary/40 bg-primary/15 text-primary"
      : event.timing === "upcoming"
        ? "border-line bg-secondary/50 text-secondary-foreground"
        : "border-line bg-secondary/30 text-muted-foreground";

  return (
    <span className={`${pill} ${cls}`}>
      <CalendarClock size={11} /> {event.timingLabel}
    </span>
  );
}

/**
 * Where *you* stand with this event — Present or Absent, and nothing when
 * neither has been recorded.
 *
 * Silent on `pending` on purpose. "Not checked in" is true of every event that
 * has not happened yet, so a badge saying it would appear on the whole calendar
 * and mean nothing; the two states worth a marker are the two somebody has
 * actually recorded. The modal says `pending` in words, where there is room to
 * explain it.
 *
 * Shown to every role except the Programming Team, whose account runs the
 * system rather than holding a seat on the org chart — see MyAttendance in
 * EventModal for the same exclusion on the modal's own attendance panel.
 * The roster — who *else* was there — stays the secretariat's; your own
 * line is simply yours.
 */
export function MyAttendanceBadge({ event }: { event: ScheduledEvent }) {
  const { officer } = useAdmin();
  const { status, statusLabel, checkedInLabel } = event.myAttendance;

  if (officer.role === "programming_team" || status === "pending") return null;

  const present = status === "present";

  return (
    <span
      className={`${pill} ${
        present
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
      // The badge says "You: Present"; the title carries the detail that would
      // not fit and that most readers do not need.
      title={
        present && checkedInLabel
          ? `You checked in at ${checkedInLabel}`
          : `Your attendance: ${statusLabel}`
      }
    >
      {present ? <UserCheck size={11} /> : <UserX size={11} />} You: {statusLabel}
    </span>
  );
}

/**
 * Shown when an event has finished with its outcome unrecorded. Aimed at,
 * and shown only to, the secretariat — the only ones who can clear it, so
 * the only ones for whom it is an outstanding task rather than a status
 * nobody else can act on.
 */
export function NeedsUpdateBadge() {
  return (
    <span className={`${pill} border-amber-accent/40 bg-amber-accent/10 text-amber-accent`}>
      <AlertTriangle size={11} /> Needs update
    </span>
  );
}
