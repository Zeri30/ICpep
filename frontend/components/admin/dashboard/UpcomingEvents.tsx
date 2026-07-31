"use client";

/* The dashboard's calendar widget.
 *
 * Not a chronological list of everything ahead — that's the Calendar module's
 * job, and it already does it. This is the two things worth a glance without
 * leaving the dashboard: what's next, and — for the secretariat only, since
 * they are the ones who can clear it — whether anything from the past still
 * needs an outcome recorded. The rest of the upcoming schedule is a
 * secondary, compact list underneath, read by every role, same as Calendar.
 */

import { AlertTriangle, CalendarDays, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import CategoryTag from "@/components/admin/schedule/CategoryTag";
import { TimingBadge } from "@/components/admin/schedule/StatusBadge";
import { formatShortDate, todayIn } from "@/components/admin/schedule/calendarDates";
import { useAdminResource } from "@/lib/adminApi";
import type { ScheduledEvent } from "@/lib/adminTypes";

/** Rows after the emphasized next event, before the rest defer to Calendar. */
const MAX_LATER_ROWS = 4;

export default function UpcomingEvents() {
  const { meta, can } = useAdmin();
  // Only the secretariat can clear an unrecorded outcome — see Calendar's
  // NeedsUpdateBadge for the same call.
  const canManageSchedule = can("schedule.manage");
  const today = useMemo(() => todayIn(meta.timezone), [meta.timezone]);
  const { data, loading } = useAdminResource<{ data: ScheduledEvent[] }>("/events");

  const { next, later, unrecordedCount } = useMemo(() => {
    const events = data?.data ?? [];
    const upcoming = events
      .filter((e) => e.date >= today && e.status !== "cancelled")
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return {
      next: upcoming[0] ?? null,
      later: upcoming.slice(1, 1 + MAX_LATER_ROWS),
      unrecordedCount: events.filter((e) => e.needsStatusUpdate).length,
    };
  }, [data, today]);

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
          Schedule
        </h2>
        <Link
          href="/admin/calendar"
          className="flex shrink-0 items-center gap-0.5 text-xs font-semibold uppercase tracking-wide text-primary transition-colors hover:text-primary-glow"
        >
          Calendar <ChevronRight size={14} />
        </Link>
      </div>

      {/* Only appears when there's a real backlog — someone has to mark a past
          event Done or Cancelled, and that's the one thing on this widget that
          is actually an outstanding task rather than a status to glance at. */}
      {canManageSchedule && unrecordedCount > 0 && (
        <Link
          href="/admin/calendar"
          className="mt-3 flex items-center gap-2 rounded-lg border border-amber-accent/30 bg-amber-accent/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-accent transition-colors hover:bg-amber-accent/15"
        >
          <AlertTriangle size={13} className="shrink-0" />
          {unrecordedCount} {unrecordedCount === 1 ? "event needs" : "events need"} an outcome recorded
        </Link>
      )}

      {loading && !data ? (
        <p className="py-6 text-sm text-muted-foreground">Loading…</p>
      ) : !next ? (
        <div className="py-8 text-center">
          <CalendarDays size={24} className="mx-auto text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">Nothing coming up.</p>
        </div>
      ) : (
        <>
          {/* Next up — the one thing worth full weight. Everything else on
              the schedule is secondary to it by definition. */}
          <div className="mt-4 flex items-start gap-4 rounded-lg border border-line bg-secondary/20 p-3.5">
            <span className="w-14 shrink-0 text-center">
              <span className="block font-display text-2xl font-black leading-none text-foreground">
                {formatShortDate(next.date).split(" ")[1]}
              </span>
              <span className="block font-head text-[11px] uppercase tracking-wide text-muted-foreground">
                {formatShortDate(next.date).split(" ")[0]}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-foreground">{next.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <CategoryTag category={next.category} />
                <span className="text-[11px] text-muted-foreground">{next.timeRangeLabel}</span>
                <TimingBadge event={next} />
              </div>
            </div>
          </div>

          {later.length > 0 && (
            <ul className="mt-1 divide-y divide-line/40">
              {later.map((e) => {
                const [month, dayOfMonth] = formatShortDate(e.date).split(" ");
                return (
                  <li key={e.id} className="flex items-center gap-3 py-2">
                    <span className="w-11 shrink-0 text-[11px] text-muted-foreground">
                      {month} {dayOfMonth}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{e.title}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{e.timeLabel}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
