"use client";

/* The organization's calendar: a month grid, and the scheduled events listed
   beside it.

   Read by every officer role. The secretariat — anyone holding schedule.manage
   — also creates here, by double-clicking the day they want. The backend
   enforces the same rule, so for every other role this screen is genuinely
   view-only and not merely a version of it with the buttons taken out. */

import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import CategoryTag, { toneFor } from "@/components/admin/schedule/CategoryTag";
import {
  MyAttendanceBadge,
  NeedsUpdateBadge,
  STATUS_ORDER,
  STATUS_TONES,
  StatusBadge,
  TimingBadge,
  pill,
} from "@/components/admin/schedule/StatusBadge";
import EventModal from "@/components/admin/schedule/EventModal";
import {
  MONTHS,
  WEEKDAYS,
  formatLongDate,
  formatShortDate,
  monthGrid,
  monthLabel,
  todayIn,
  ymd,
} from "@/components/admin/schedule/calendarDates";
import { Bar, Pill } from "@/components/admin/ui/Skeleton";
import { useEventsResource } from "@/components/admin/useEventsResource";
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
 * The outcome being filtered on, or null for no filter at all.
 *
 * It asks the whole calendar rather than the slice the scope had selected, and
 * so replaces the scope while it is on rather than narrowing it. "Show me the
 * done ones" is a question about the record: an event is only ever marked Done
 * or Cancelled once it is over, so asking it of Upcoming — the default — would
 * answer "none" for a calendar full of them, which reads as a broken filter
 * rather than as a scope that excluded the answer.
 */
type StatusFilter = ScheduledEvent["status"] | null;

/**
 * How many events on the calendar hold each outcome.
 *
 * Counted over everything, not the current slice, so a chip means the same
 * number before and after it is clicked.
 */
type StatusCounts = Record<ScheduledEvent["status"], number>;

/**
 * What the list says when a slice turns up nothing. Constant, so they sit here
 * with the scopes they belong to rather than being rebuilt on every render —
 * only the month's needs the month's name, which is why it is a function.
 */
const EMPTY_COPY: Record<Scope, (monthName: string) => { heading: string; body: string }> = {
  upcoming: () => ({
    heading: "Nothing coming up",
    body: "Past events are still on the calendar — switch to All to see them.",
  }),
  month: (monthName) => ({
    heading: `Nothing in ${monthName}`,
    body: "Page to another month, or switch to All.",
  }),
  all: () => ({
    heading: "No events scheduled yet",
    body: "Events the Secretary and Assistant Secretary schedule will be listed here.",
  }),
  unrecorded: () => ({
    heading: "Everything is accounted for",
    body: "No past event is still waiting to be marked done or cancelled.",
  }),
};

/**
 * How many events a day cell shows before it collapses into a count.
 *
 * Three fit the cell at its smallest desktop height. A fourth would overflow,
 * so at four or more the cell shows two and hands the rest to the list — where
 * there is room to read them — rather than clipping something mid-word and
 * hoping nobody needed it.
 */
const MAX_CHIPS = 3;

/**
 * How many rows the schedule list renders at a time.
 *
 * The list can hold a whole chapter-year's events at once — every past
 * meeting, every deadline — and rendering all of them the moment a filter is
 * touched is wasted work the officer scrolling three rows down never asked
 * for. Ten is enough to fill the panel without scrolling on a normal laptop,
 * so the first paint already looks complete.
 */
const PAGE_SIZE = 10;

/** One row of the schedule list, in placeholder form. Mirrors the real row's
    shape (date block, title, tag row) so the panel is exactly as tall while
    the events load as once they land — see MembersList's DataTable columns
    for the same reasoning applied to a table instead of this list. */
function EventRowSkeleton() {
  return (
    <li className="flex w-full items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex w-12 shrink-0 flex-col items-center gap-1">
        <span className="skeleton block h-4 w-6 rounded" />
        <span className="skeleton block h-3 w-8 rounded" />
      </span>
      <span className="min-w-0 flex-1">
        <Bar w="w-3/5" />
        <span className="mt-2 flex items-center gap-1.5">
          <Pill w="w-16" />
          <Bar w="w-12" h="h-3" />
        </span>
      </span>
    </li>
  );
}

export default function EventCalendar() {
  const { meta, can } = useAdmin();
  const canManage = can("schedule.manage");

  // "Today" as a day in the organization's timezone — the same day the API
  // files events under, which is not necessarily the viewer's device's.
  const today = useMemo(() => todayIn(meta.timezone), [meta.timezone]);

  const { data, loading, error, refresh } = useEventsResource<{ data: ScheduledEvent[] }>();
  const events = useMemo(() => data?.data ?? [], [data]);

  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month: month - 1 };
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("upcoming");
  const [status, setStatus] = useState<StatusFilter>(null);
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

  const statusCounts = useMemo(() => {
    const counts: StatusCounts = { scheduled: 0, done: 0, cancelled: 0 };
    for (const e of events) counts[e.status]++;
    return counts;
  }, [events]);

  // Three questions, each answered on its own and in this order of precedence:
  // a chosen day beats a chosen outcome, which beats the time scope. Each is
  // narrower than the one below it, so the one the officer picked last is the
  // one they get — and none of them can silently combine into an empty list
  // whose emptiness nobody asked for.
  const listed = useMemo(() => {
    if (selected) return byDate.get(selected) ?? [];
    if (status) {
      const matching = events.filter((e) => e.status === status);
      // Done and Cancelled are a record of what happened, and a record reads
      // newest first — soonest-first would open a year of done events on one
      // from last September. Scheduled keeps the calendar's own order, because
      // it is the one outcome that still holds events yet to happen.
      return status === "scheduled" ? matching : matching.reverse();
    }
    if (scope === "upcoming") return events.filter((e) => e.date >= today);
    if (scope === "month") return events.filter((e) => e.date.startsWith(monthPrefix));
    if (scope === "unrecorded") return events.filter((e) => e.needsStatusUpdate);
    return events;
  }, [selected, byDate, status, scope, events, today, monthPrefix]);

  // Events that have finished with nobody saying what became of them. The
  // count is what makes the backlog visible — one forgotten event is easy to
  // miss on a grid, eleven of them should be impossible to.
  const unrecorded = useMemo(
    () => events.filter((e) => e.needsStatusUpdate).length,
    [events],
  );

  /**
   * The years the header's picker offers.
   *
   * Only years that have actually arrived, so a chapter's first year opens on a
   * single entry rather than a list of empty futures. The list grows on its own
   * — on the 1st of January the new year appears and every year before it stays,
   * because those events are still the organization's record and the point of
   * the picker is reaching them.
   *
   * Two things widen it beyond that. A year holding an event is always listed,
   * so a meeting booked ahead of the turn of the year can still be reached; and
   * the month on screen is always listed, so paging past the edge with the
   * arrows cannot leave the picker showing a year it does not offer.
   */
  const years = useMemo(() => {
    const thisYear = Number(today.slice(0, 4));
    let first = Math.min(thisYear, cursor.year);
    let last = Math.max(thisYear, cursor.year);

    for (const e of events) {
      const year = Number(e.date.slice(0, 4));
      if (year < first) first = year;
      if (year > last) last = year;
    }

    return Array.from({ length: last - first + 1 }, (_, i) => first + i);
  }, [events, today, cursor.year]);

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
            Schedules
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManage
              ? "Double-click a date to schedule an event."
              : "Scheduled events, kept by the Secretary and Assistant Secretary."}{" "}
            All times {meta.timezone.replace("_", " ")}.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => openDay(defaultNewDate())}
            // Sized to the schedule panel it sits above, full width where that
            // column is. The two right edges lining up exactly reads as
            // deliberate; nearly lining up reads as a mistake — so this tracks
            // the panel's own two breakpoints: 19rem on a smaller desktop,
            // widening to 22rem once there's room to spare (see the grid below).
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent lg:w-76 xl:w-88"
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

      {/* The list column holds its text comfortably at 19rem, so it's the
          calendar that gives up the width a smaller desktop is short on — a
          fixed 22rem there would otherwise squeeze the seven-day grid into a
          sliver right at the breakpoint where the two-column layout kicks in.
          xl+ (1280px, roughly a standard monitor) restores the original
          proportions, where there's room for both to breathe. */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-3 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-4">
        <section className="flex min-h-0 flex-col rounded-xl border border-line bg-card">
          <MonthHeader
            year={cursor.year}
            month={cursor.month}
            years={years}
            loading={loading && !data}
            onPick={(year, month) => setCursor({ year, month })}
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
          status={status}
          statusCounts={statusCounts}
          unrecorded={unrecorded}
          canManageSchedule={canManage}
          monthName={monthLabel(cursor.year, cursor.month)}
          loading={loading && !data}
          onScope={(s) => {
            setScope(s);
            // Changing the scope is a request to see that slice, which a
            // lingering day filter would silently override.
            setSelected(null);
          }}
          onStatus={setStatus}
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

/**
 * The month on screen, and the ways to change it.
 *
 * The heading *is* the picker: two selects wearing the display type the title
 * used to. A calendar that can only be paged a month at a time makes last
 * February eight clicks away, and the arrows are still there for the far more
 * common step of one — so the pair covers both without adding a control that
 * has to be found first.
 */
function MonthHeader({
  year,
  month,
  years,
  loading,
  onPick,
  onPrev,
  onNext,
  onToday,
}: {
  year: number;
  /** 0-indexed, as Date has it. */
  month: number;
  years: number[];
  loading: boolean;
  onPick: (year: number, month: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const navCls =
    "grid size-7 shrink-0 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:size-8";

  return (
    // The date picker, Today, and the arrows are each sized down on a phone
    // so the full row has a real shot at fitting on one line; `flex-wrap`
    // stays on as a fallback rather than forcing a stacked layout outright,
    // so it only breaks onto a second line on the very narrowest screens.
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/60 px-2 py-2.5 sm:gap-3 sm:px-3 sm:py-3">
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
        {/* The selects carry their own labels, but the grid keeps a heading so
            the page's outline still says which month is being read. */}
        <h2 className="sr-only">{monthLabel(year, month)}</h2>

        <HeaderSelect
          label="Month"
          value={month}
          onChange={(next) => onPick(year, next)}
          options={MONTHS.map((name, i) => ({ value: i, label: name }))}
        />
        <HeaderSelect
          label="Year"
          value={year}
          onChange={(next) => onPick(next, month)}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />

        {loading && <Loader2 size={13} className="ml-1 shrink-0 animate-spin text-muted-foreground" />}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button type="button" onClick={onToday} className="shrink-0 rounded-md border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:px-3 sm:py-1.5 sm:text-[11px]">
          Today
        </button>
        <button type="button" onClick={onPrev} aria-label="Previous month" className={navCls}>
          <ChevronLeft size={15} />
        </button>
        <button type="button" onClick={onNext} aria-label="Next month" className={navCls}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * One half of the heading, as a dropdown.
 *
 * A native select rather than a custom menu: it is already keyboard-operable,
 * it scrolls a long year list on its own, and on a phone it opens the platform
 * picker — all things a hand-built panel would have to earn back. The chevron
 * is drawn over it because `appearance-none` is what lets the closed state wear
 * the heading's type rather than the OS's.
 *
 * Dressed as a control rather than as text: bordered, on a raised fill, with
 * the chevron in the accent colour. Type this large reads as a title, and a
 * title is not something anyone thinks to click — the box is what says
 * otherwise before the pointer ever reaches it.
 */
function HeaderSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  return (
    <span className="relative inline-flex items-center rounded-lg border border-line bg-secondary/50 transition-colors hover:border-primary/60 hover:bg-secondary focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="cursor-pointer appearance-none bg-transparent py-1 pl-2 pr-6 font-display text-sm font-black uppercase tracking-wide text-foreground outline-none sm:pl-2.5 sm:pr-7 sm:text-lg lg:pr-6 lg:text-base xl:pr-7 xl:text-lg"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card font-sans text-sm normal-case">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        aria-hidden
        strokeWidth={2.5}
        className="pointer-events-none absolute right-1.5 text-primary sm:right-2 lg:right-1.5 xl:right-2"
      />
    </span>
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
    // buy nothing here. Only the secretariat can act on the cell itself, so
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
      className={`group flex min-h-24 flex-col gap-1 border-b border-r border-line/40 p-1.5 text-left outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/60 lg:p-1 xl:p-1.5 ${
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
                      change what the event means each get one character. Only
                      the secretariat can clear an unrecorded outcome, so only
                      they get the second one — see NeedsUpdateBadge. */}
                  {e.status === "done" && <Check size={9} className="shrink-0" />}
                  {canManage && e.needsStatusUpdate && (
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
  status,
  statusCounts,
  unrecorded,
  canManageSchedule,
  monthName,
  loading,
  onScope,
  onStatus,
  onClear,
  onOpen,
}: {
  ref: React.Ref<HTMLElement>;
  events: ScheduledEvent[];
  selected: string | null;
  scope: Scope;
  status: StatusFilter;
  statusCounts: StatusCounts;
  unrecorded: number;
  /** Only the secretariat can act on an unrecorded outcome — see NeedsUpdateBadge. */
  canManageSchedule: boolean;
  monthName: string;
  loading: boolean;
  onScope: (scope: Scope) => void;
  onStatus: (status: StatusFilter) => void;
  onClear: () => void;
  onOpen: (event: ScheduledEvent) => void;
}) {
  // The outcome the list is filtered on, as a word — "cancelled" — for the
  // count and the empty state, both of which read as sentences.
  const outcome = status === null ? null : STATUS_TONES[status].label.toLowerCase();

  // The backlog is a scope, so an outcome supersedes it just like the others.
  const showingBacklog = status === null && scope === "unrecorded";

  const empty =
    // The outcome filter replaces the scope, so it is the whole explanation
    // when it is on: there is no month or slice left to blame.
    outcome !== null
      ? {
          heading: `Nothing ${outcome}`,
          body: `No event on the calendar is marked ${outcome}.`,
        }
      : EMPTY_COPY[scope](monthName);

  // How many rows are on screen right now. Starts over at one page whenever
  // the slice itself changes — a new day, outcome, or scope is a different
  // list, and paging three screens into the old one would leave the new one
  // looking cut off for no reason the officer caused. Reset during render
  // (React's documented pattern for "state that tracks a prop") rather than
  // in an effect, so the list doesn't flash a stale page before catching up.
  const [prevEvents, setPrevEvents] = useState(events);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  if (events !== prevEvents) {
    setPrevEvents(events);
    setVisibleCount(PAGE_SIZE);
  }

  const visible = events.slice(0, visibleCount);
  const hasMore = visibleCount < events.length;

  // The panel scrolls itself (see the height comment on EventCalendar's root),
  // so the sentinel has to be watched against that div rather than the
  // window — the default root would fire the moment the panel appears
  // anywhere on the page, long before its own scrollbar reaches bottom.
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // Appends onto the list already rendered rather than replacing it, so
        // the browser has no reason to move the scroll position it is
        // mid-observing — a reset here is what would make "seamless" a lie.
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, events.length));
      },
      // Loads a little before the sentinel is actually on screen, so the next
      // page is already in the DOM by the time the officer's eye gets there.
      { root, rootMargin: "160px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [events, visibleCount]);

  return (
    <section ref={ref} className="flex min-h-0 flex-col rounded-xl border border-line bg-card">
      <div className="border-b border-line/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {/* "Schedule" rather than "Scheduled events": one of the outcomes
                below is itself called Scheduled, and a panel headed "Scheduled
                events" listing the cancelled ones would contradict itself. */}
            <h2 className="truncate font-head text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
              {selected ? formatLongDate(selected) : "Schedule"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {events.length} {!selected && outcome ? `${outcome} ` : ""}
              {events.length === 1 ? "event" : "events"}
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

        {/* Hidden while a single day is showing — the filters do not apply to
            it, and offering a control that changes nothing is a small lie. */}
        {!selected && (
          <>
            {/* Above the scope, and always here: this row is what the scope row
                below comes and goes under, so putting it second would make the
                chips jump every time one was picked. */}
            <div role="group" aria-label="Filter by outcome" className="mt-3 flex flex-wrap gap-1">
              {STATUS_ORDER.map((value) => (
                <StatusChip
                  key={value}
                  value={value}
                  count={statusCounts[value]}
                  active={status === value}
                  // Clicking the one already on clears it — the only way back
                  // to everything, now that there is no "Any" to return to.
                  onClick={() => onStatus(status === value ? null : value)}
                />
              ))}
            </div>

            {/* The scope answers "when", and an outcome supersedes it: while one
                is chosen the list is the whole calendar's worth of them, and a
                highlighted Upcoming beside it would be describing a slice that
                is not on screen. */}
            {status === null && (
              <div className="mt-2 flex rounded-lg border border-line p-0.5">
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
            )}

            {/* Only when there is a backlog, and it leaves once cleared — a
                permanent "0 need an update" row is furniture nobody reads.
                Stays put while an outcome is chosen, unlike the scope: the
                backlog is drawn from the Scheduled ones, so it is most worth
                reaching from exactly the chip that would otherwise hide it.
                Clicking clears the outcome, because the two cannot both win.
                Only the secretariat can clear one, so it is the only audience
                this is shown to — see NeedsUpdateBadge for the same call. */}
            {canManageSchedule && (unrecorded > 0 || showingBacklog) && (
              <button
                type="button"
                onClick={() => {
                  onStatus(null);
                  onScope(showingBacklog ? "upcoming" : "unrecorded");
                }}
                aria-pressed={showingBacklog}
                className={`mt-2 flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  showingBacklog
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

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <>
            {/* Hidden from assistive tech: the placeholders carry no
                information, and a screen reader announcing ten empty rows is
                worse than the one honest "Loading…" the status below gives. */}
            <ul className="divide-y divide-line/40" aria-hidden="true">
              {Array.from({ length: PAGE_SIZE }, (_, i) => (
                <EventRowSkeleton key={i} />
              ))}
            </ul>
            <span role="status" className="sr-only">
              Loading the calendar…
            </span>
          </>
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
            {visible.map((e) => {
              // "Nov 04" once, rather than formatting the same date twice to
              // read one half of it each time.
              const [month, dayOfMonth] = formatShortDate(e.date).split(" ");
              return (
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
                      {dayOfMonth}
                    </span>
                    <span className="block font-head text-[10px] uppercase tracking-wide text-muted-foreground">
                      {month}
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
                      {/* Your own line, and only ever yours — who else was
                          there is the roster's business. Silent until there is
                          something recorded, so it does not appear on every
                          event that has yet to happen. */}
                      <MyAttendanceBadge event={e} />
                      {canManageSchedule && e.needsStatusUpdate && <NeedsUpdateBadge />}
                    </span>
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        )}

        {/* Doubles as the infinite-scroll trigger and its own status line —
            there is nothing to watch once every event is on screen, so it is
            the one thing here that genuinely disappears rather than sitting
            empty. */}
        {hasMore && (
          <div ref={sentinelRef} className="px-4 py-3 text-center text-[11px] text-muted-foreground">
            Loading more events…
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One outcome in the filter row, with how many events on the calendar hold it.
 *
 * The count is the point: it turns the row into a summary of the record as well
 * as a control over it, and a chip reading 0 says so before it is clicked
 * rather than after. Counted over everything, because clicking shows everything
 * — a chip that read 0 and then produced seven would be worse than no count at
 * all. Each wears its own colour only while it is the one being filtered on;
 * three colours at rest would compete with the events below, which is where
 * colour is meant to carry meaning.
 *
 * Takes the status itself rather than a label and a colour, so a fourth outcome
 * would be one line in {@link STATUS_TONES} and nothing here.
 */
function StatusChip({
  value,
  count,
  active,
  onClick,
}: {
  value: ScheduledEvent["status"];
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const { label, badge } = STATUS_TONES[value];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`${pill} transition-colors ${
        active
          ? badge
          : "border-line text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      {label}
      <span className={`tabular-nums ${active ? "opacity-70" : "text-muted-foreground/60"}`}>
        {count}
      </span>
    </button>
  );
}
