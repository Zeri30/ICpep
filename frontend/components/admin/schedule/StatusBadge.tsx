"use client";

/* The two badges an event wears: what became of it, and when it is.

   They are separate on purpose. A date that has passed says the event was due,
   not that it happened — so "3 days ago" and "Done" are different claims, and
   an event can carry the first while still waiting for the second. That gap is
   what `needsStatusUpdate` marks. */

import { AlertTriangle, CalendarClock, CheckCircle2, CircleDot, XCircle } from "lucide-react";
import type { ScheduledEvent } from "@/lib/adminTypes";

const STATUS = {
  scheduled: { cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: CircleDot },
  done: { cls: "border-green-500/30 bg-green-500/10 text-green-400", Icon: CheckCircle2 },
  cancelled: { cls: "border-red-500/30 bg-red-500/10 text-red-400", Icon: XCircle },
} as const;

const pill =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function StatusBadge({ event }: { event: ScheduledEvent }) {
  const { cls, Icon } = STATUS[event.status];
  return (
    <span className={`${pill} ${cls}`}>
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
 * Shown when an event's day has gone by with its outcome unrecorded. Aimed at
 * the Secretary, who is the only one who can clear it — but visible to every
 * role, because "did that meeting actually happen?" is everyone's question.
 */
export function NeedsUpdateBadge() {
  return (
    <span className={`${pill} border-amber-accent/40 bg-amber-accent/10 text-amber-accent`}>
      <AlertTriangle size={11} /> Needs update
    </span>
  );
}
