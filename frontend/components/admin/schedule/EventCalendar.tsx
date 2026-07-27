"use client";

/* The organization's calendar: a month grid, and the scheduled events listed
   beside it.

   Read by every officer role. The Secretary — anyone holding schedule.manage —
   also creates here, by double-clicking the day they want. The backend enforces
   the same rule, so for every other role this screen is genuinely view-only and
   not merely a version of it with the buttons taken out. */

import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import CategoryTag, { toneFor } from "@/components/admin/schedule/CategoryTag";
import {
  NeedsUpdateBadge,
  StatusBadge,
  TimingBadge,
} from "@/components/admin/schedule/StatusBadge";
import EventModal from "@/components/admin/schedule/EventModal";
import {
  WEEKDAYS,
  formatLongDate,
  formatShortDate,
  monthGrid,
  monthLabel,
  todayIn,
  ymd,
} from "@/components/admin/schedule/calendarDates";
import { useAdminResource } from "@/lib/adminApi";
import type { ScheduledEvent } from "@/lib/adminTypes";

/** What the modal is currently doing: closed, opening a day, or opening an event. */
type ModalState = { open: boolean; event: ScheduledEvent | null; date: string | null };

const CLOSED: ModalState = { open: false, event: null, date: null };

/**
 * Which slice of the schedule the list beside the grid is showing.
 *
 * "Upcoming" is the default because a calendar is opened to find out what is
 * next far more often than to audit what already happened — and after a couple
 * of semesters, "everything, oldest first" opens on events from last year.
 * The past is still one click away, because the calendar is a record too.
 */
type Scope = "upcoming" | "month" | "all" | "unrecorded";

/** The three that are always offered. "unrecorded" appears only when it applies. */
const SCOPES: { value: Scope; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "month", label: "This month" },
  { value: "all", label: "All" },
];

/**
 * How many events a day cell shows before it collapses into a count.
 *
 * Three fit the cell at its smallest desktop height. A fourth would overflow,
 * so at four or more the cell shows two and hands the rest to the list — where
 * there is room to read them — rather than clipping something mid-word and
 * hoping nobody needed it.
 */
const MAX_CHIPS = 3;

export default function EventCalendar() {
  const { meta, can } = useAdmin();
  const canManage = can("schedule.manage");

  // "Today" as a day in the organization's timezone — the same day the API
  // files events under, which is not necessarily the viewer's device's.
  const today = useMemo(() => todayIn(meta.timezone), [meta.timezone]);

  const { data, loading, error, refresh } = useAdminResource<{ data: ScheduledEvent[] }>("/events");
  const events = useMemo(() => data?.data ?? [], [data]);

  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month: month - 1 };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [modal, setModal] = useState<ModalState>(CLOSED);

  const listRef = useRef<HTMLElement>(null);

  const cells = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);

  // "2026-11" for the month on screen. Built through ymd so the two edge months
  // roll over rather than producing a month 0 or 13.
  const monthPrefix = useMemo(() => ymd(cursor.year, cursor.month, 1).slice(0, 7), [cursor]);

  // One lookup per day, so each of the 42 cells is a map hit rather than a scan
  // of the whole schedule.
  const byDate = useMemo(() => {
    const map = new Map<string, ScheduledEvent[]>();
    for (const e of events) {
      const day = map.get(e.date);
      if (day) day.push(e);
      else map.set(e.date, [e]);
    }
    return map;
  }, [events]);

  // A selected day overrides the scope entirely: having asked for one date, the
  // officer is shown that date and nothing else, until they clear it.
  const listed = useMemo(() => {
    if (selected) return byDate.get(selected) ?? [];
    if (scope === "upcoming") return events.filter((e) => e.date >= today);
    if (scope === "month") return events.filter((e) => e.date.startsWith(monthPrefix));
    if (scope === "unrecorded") return events.filter((e) => e.needsStatusUpdate);
    return events;
  }, [selected, byDate, scope, events, today, monthPrefix]);

  // Events whose day has gone by with nobody saying what became of them. The
  // count is what makes the backlog visible — one forgotten event is easy to
  // miss on a grid, eleven of them should be impossible to.
  const unrecorded = useMemo(
    () => events.filter((e) => e.needsStatusUpdate).length,
    [events],
  );

  const step = (by: number) => {
    const d = new Date(cursor.year, cursor.month + by, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  };

  const goToday = () => {
    const [year, month] = today.split("-").map(Number);
    setCursor({ year, month: month - 1 });
    setSelected(null);
  };

  /**
   * Select a day, and on a narrow screen bring the list into view — it sits
   * below the grid there, so "+2 more" would otherwise appear to do nothing.
   */
  const selectDay = useCallback((date: string, reveal = false) => {
    setSelected(date);
    if (!reveal) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) return;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  /** Move the grid to the month a date falls in, and select it. */
  const jumpToMonth = useCallback((date: string) => {
    const [year, month] = date.split("-").map(Number);
    setCursor({ year, month: month - 1 });
    setSelected(date);
  }, []);

  const openDay = (date: string) => {
    if (!canManage) return;
    setModal({ open: true, event: null, date });
  };

  const openEvent = (event: ScheduledEvent) => setModal({ open: true, event, date: null });

  /**
   * Where "New event" starts from: the selected day, or — when the officer has
   * paged away to another month — that month's first day rather than a today
   * they are not looking at.
   */
  const defaultNewDate = () =>
    selected ?? (today.startsWith(monthPrefix) ? today : ymd(cursor.year, cursor.month, 1));

  const afterSave = useCallback(
    (date?: string) => {
      refresh();
      // Land on the day just scheduled — including moving the grid, since the
      // date can be changed in the form to one in another month. An event that
      // saves successfully and then appears nowhere reads as a failure.
      if (date) jumpToMonth(date);
    },
    [refresh, jumpToMonth],
  );

  // The categories actually on the calendar — a legend listing all eight when
  // only two are in use is noise.
  const legend = useMemo(
    () => Array.from(new Set(events.map((e) => e.category))).sort(),
    [events],
  );

  return (
    // Fills the space under the topbar and scrolls the list internally, matching
    // the other modules (see PaymentHistory for the height maths).
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">
            Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Double-click a date to schedule an event."
              : "Scheduled events, kept by the Secretary."}{" "}
            All times {meta.timezone.replace("_", " ")}.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => openDay(defaultNewDate())}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent"
          >
            <CalendarPlus size={16} /> New event
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-h-0 flex-col rounded-xl border border-line bg-card">
          <MonthHeader
            label={monthLabel(cursor.year, cursor.month)}
            loading={loading && !data}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onToday={goToday}
          />

          <div className="grid grid-cols-7 border-b border-line/60">
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                className="px-2 py-2 text-center font-head text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              >
                {/* The three-letter name is too wide on a narrow phone. */}
                <span className="hidden sm:inline">{w}</span>
                <span className="sm:hidden">{w[0]}</span>
              </div>
            ))}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-y-auto">
            {cells.map((cell) => (
              <DayCell
                key={cell.date}
                date={cell.date}
                day={cell.day}
                inMonth={cell.inMonth}
                isToday={cell.date === today}
                isSelected={cell.date === selected}
                events={byDate.get(cell.date) ?? []}
                canManage={canManage}
                onSelect={() => selectDay(cell.date)}
                onShowMore={() => selectDay(cell.date, true)}
                onCreate={() => openDay(cell.date)}
                onJumpToMonth={() => jumpToMonth(cell.date)}
                onOpenEvent={openEvent}
              />
            ))}
          </div>

          {legend.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 px-3 py-2.5">
              {legend.map((c) => (
                <span key={c} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`size-2 rounded-full ${toneFor(c).dot}`} />
                  {c}
                </span>
              ))}
            </div>
          )}
        </section>

        <EventList
          ref={listRef}
          events={listed}
          selected={selected}
          scope={scope}
          unrecorded={unrecorded}
          monthName={monthLabel(cursor.year, cursor.month)}
          loading={loading && !data}
          onScope={(s) => {
            setScope(s);
            // Changing the scope is a request to see that slice, which a
            // lingering day filter would silently override.
            setSelected(null);
          }}
          onClear={() => setSelected(null)}
          onOpen={openEvent}
        />
      </div>

      <EventModal
        open={modal.open}
        event={modal.event}
        date={modal.date}
        onSaved={afterSave}
        onClose={() => setModal(CLOSED)}
      />
    </div>
  );
}

function MonthHeader({
  label,
  loading,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const navCls =
    "grid size-8 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-3">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-lg font-black uppercase tracking-wide text-foreground">
          {label}
        </h2>
        {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onToday} className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground">
          Today
        </button>
        <button type="button" onClick={onPrev} aria-label="Previous month" className={navCls}>
          <ChevronLeft size={16} />
        </button>
        <button type="button" onClick={onNext} aria-label="Next month" className={navCls}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function DayCell({
  date,
  day,
  inMonth,
  isToday,
  isSelected,
  events,
  canManage,
  onSelect,
  onShowMore,
  onCreate,
  onJumpToMonth,
  onOpenEvent,
}: {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: ScheduledEvent[];
  canManage: boolean;
  onSelect: () => void;
  onShowMore: () => void;
  onCreate: () => void;
  onJumpToMonth: () => void;
  onOpenEvent: (event: ScheduledEvent) => void;
}) {
  // Scheduling happens on the month being looked at. A greyed-out day belongs to
  // the month either side, and creating on it would file an event into a month
  // the officer is not looking at — so a double-click there moves the grid to
  // that month first, and opens the form on the date they actually pointed at.
  const canCreate = canManage && inMonth;

  // At four or more, two chips plus the count read better than three plus a
  // "+1" — the same number of lines, but the overflow is worth the row.
  const overflowing = events.length > MAX_CHIPS;
  const shown = overflowing ? events.slice(0, MAX_CHIPS - 1) : events;
  const hidden = events.length - shown.length;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    // A labelled group rather than a gridcell: gridcell is only meaningful
    // inside a role="grid"/"row" tree, and wrapping each week in a row would
    // buy nothing here. Only the Secretary can act on the cell itself, so
    // only they get it in the tab order — 42 focus stops that do nothing
    // would make the calendar tedious to tab past for everyone else, who
    // reach the events through the chips and the list instead.
    <div
      role="group"
      aria-label={`${formatLongDate(date)}${events.length ? `, ${events.length} event${events.length > 1 ? "s" : ""}` : ", no events"}`}
      tabIndex={canCreate ? 0 : undefined}
      onClick={inMonth ? onSelect : onJumpToMonth}
      onDoubleClick={() => {
        if (!canManage) return;
        if (!inMonth) onJumpToMonth();
        onCreate();
      }}
      onKeyDown={(e) => {
        // Enter is the keyboard equivalent of the double-click; without it the
        // only way to schedule would be a pointer.
        if (e.key !== "Enter" || e.target !== e.currentTarget || !canCreate) return;
        e.preventDefault();
        onSelect();
        onCreate();
      }}
      className={`group flex min-h-24 flex-col gap-1 border-b border-r border-line/40 p-1.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/60 ${
        inMonth ? "" : "bg-background/40"
      } ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"} ${canCreate ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
            isToday
              ? "bg-primary text-white"
              : inMonth
                ? "text-foreground"
                : "text-muted-foreground/50"
          }`}
        >
          {day}
        </span>
        {canCreate && (
          <span className="opacity-0 transition-opacity group-hover:opacity-100">
            <CalendarPlus size={12} className="text-muted-foreground" />
          </span>
        )}
      </div>

      {events.length > 0 && (
        <>
          {/* Phones: a cell is a few characters wide, so a title would be
              truncated to nothing useful. Coloured dots carry the same
              information the chips do — how many, and of what kind — and the
              day opens in the list for the detail. */}
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onShowMore();
            }}
            aria-label={`Show the ${events.length} event${events.length > 1 ? "s" : ""} on this day`}
            className="flex flex-wrap items-center gap-0.5 sm:hidden"
          >
            {events.slice(0, 3).map((e) => (
              <span key={e.id} className={`size-1.5 rounded-full ${toneFor(e.category).dot}`} />
            ))}
            {events.length > 3 && (
              <span className="text-[9px] font-semibold text-muted-foreground">
                +{events.length - 3}
              </span>
            )}
          </button>

          <div className="hidden flex-col gap-1 sm:flex">
            {shown.map((e) => {
              const tone = toneFor(e.category);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={(ev) => {
                    // Without this the cell's own click also fires and the day
                    // gets selected behind the modal.
                    stop(ev);
                    onOpenEvent(e);
                  }}
                  onDoubleClick={stop}
                  title={`${e.timeRangeLabel} · ${e.title} (${e.category}) — ${e.statusLabel}`}
                  className={`flex w-full items-center gap-1 truncate rounded border px-1 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80 ${tone.chip} ${
                    e.status === "cancelled" ? "opacity-50" : ""
                  }`}
                >
                  <span className={`size-1 shrink-0 rounded-full ${tone.dot}`} />
                  <span className={`truncate ${e.status === "cancelled" ? "line-through" : ""}`}>
                    {e.title}
                  </span>
                  {/* A day cell has no room for a badge, so the two states that
                      change what the event means each get one character. */}
                  {e.status === "done" && <Check size={9} className="shrink-0" />}
                  {e.needsStatusUpdate && (
                    <span className="ml-auto size-1 shrink-0 rounded-full bg-amber-accent" />
                  )}
                </button>
              );
            })}
            {hidden > 0 && (
              <button
                type="button"
                onClick={(ev) => {
                  stop(ev);
                  onShowMore();
                }}
                onDoubleClick={stop}
                className="rounded px-1 text-left text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                +{hidden} more
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The schedule beside the grid: a slice of it, or one selected day. */
function EventList({
  ref,
  events,
  selected,
  scope,
  unrecorded,
  monthName,
  loading,
  onScope,
  onClear,
  onOpen,
}: {
  ref: React.Ref<HTMLElement>;
  events: ScheduledEvent[];
  selected: string | null;
  scope: Scope;
  unrecorded: number;
  monthName: string;
  loading: boolean;
  onScope: (scope: Scope) => void;
  onClear: () => void;
  onOpen: (event: ScheduledEvent) => void;
}) {
  const empty = {
    upcoming: {
      heading: "Nothing coming up",
      body: "Past events are still on the calendar — switch to All to see them.",
    },
    month: { heading: `Nothing in ${monthName}`, body: "Page to another month, or switch to All." },
    all: {
      heading: "No events scheduled yet",
      body: "Events the Secretary schedules will be listed here.",
    },
    unrecorded: {
      heading: "Everything is accounted for",
      body: "No past event is still waiting to be marked done or cancelled.",
    },
  }[scope];

  return (
    <section ref={ref} className="flex min-h-0 flex-col rounded-xl border border-line bg-card">
      <div className="border-b border-line/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-head text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
              {selected ? formatLongDate(selected) : "Scheduled events"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {events.length} {events.length === 1 ? "event" : "events"}
              {selected ? " on this day" : ""}
            </p>
          </div>
          {selected && (
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 rounded-md border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Hidden while a single day is showing — the scope does not apply to
            it, and offering a control that changes nothing is a small lie. */}
        {!selected && (
          <>
            <div className="mt-3 flex rounded-lg border border-line p-0.5">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onScope(s.value)}
                  aria-pressed={scope === s.value}
                  className={`flex-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                    scope === s.value
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Only when there is a backlog, and it leaves once cleared —
                a permanent "0 need an update" row is furniture nobody reads. */}
            {(unrecorded > 0 || scope === "unrecorded") && (
              <button
                type="button"
                onClick={() => onScope(scope === "unrecorded" ? "upcoming" : "unrecorded")}
                aria-pressed={scope === "unrecorded"}
                className={`mt-2 flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  scope === "unrecorded"
                    ? "border-amber-accent/50 bg-amber-accent/15 text-amber-accent"
                    : "border-amber-accent/30 text-amber-accent hover:bg-amber-accent/10"
                }`}
              >
                <AlertTriangle size={12} />
                {unrecorded} {unrecorded === 1 ? "event needs" : "events need"} an update
              </button>
            )}
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading the calendar…</p>
        ) : events.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <CalendarDays size={28} className="mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              {selected ? "Nothing on this day" : empty.heading}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected ? "Pick another date, or clear the filter." : empty.body}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line/40">
            {events.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpen(e)}
                  // A finished event recedes; a cancelled one recedes further
                  // and is struck through, so it reads as called off rather
                  // than merely over. Anything still ahead stays at full
                  // strength.
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 ${
                    e.status === "cancelled"
                      ? "opacity-45"
                      : e.timing === "past"
                        ? "opacity-70"
                        : ""
                  }`}
                >
                  <span className="mt-0.5 w-12 shrink-0 text-center">
                    <span className="block font-display text-base font-black leading-none text-foreground">
                      {formatShortDate(e.date).split(" ")[1]}
                    </span>
                    <span className="block font-head text-[10px] uppercase tracking-wide text-muted-foreground">
                      {formatShortDate(e.date).split(" ")[0]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-semibold text-foreground ${
                        e.status === "cancelled" ? "line-through decoration-red-400/70" : ""
                      }`}
                    >
                      {e.title}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <CategoryTag category={e.category} />
                      <span className="text-[11px] text-muted-foreground">{e.timeRangeLabel}</span>
                      <TimingBadge event={e} />
                      {/* "Scheduled" is the default and says nothing worth the
                          space; the two closed states do. */}
                      {e.status !== "scheduled" && <StatusBadge event={e} />}
                      {e.needsStatusUpdate && <NeedsUpdateBadge />}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
