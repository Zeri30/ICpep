"use client";

import { type MotionValue, motion, useScroll, useTransform } from "motion/react";
import { ArrowUpRight, Calendar, ChevronDown, ChevronUp, Clock, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { API_URL } from "@/lib/config";
import type { EventTone } from "@/lib/data";

/** How tall the "Next Up" panel gets before it scrolls internally rather than
    pushing the rest of the landing page down — a handful of events fit without
    a scrollbar ever appearing, a whole semester's worth doesn't turn this
    section into the tallest thing on the page. */
const PANEL_MAX_HEIGHT = "min(66vh, 620px)";

/** One row of GET /api/events/upcoming — see backend UpcomingEventsController. */
type UpcomingEvent = {
  id: number;
  title: string;
  category: string;
  venue: string | null;
  date: string;
  dateLabel: string;
  timeLabel: string;
  timing: "today" | "upcoming";
  timingLabel: string;
  description: string | null;
};

/**
 * The Secretariat's calendar, live. Empty (not a hardcoded fallback) while
 * loading or on a failed fetch — a stale event that has since passed or been
 * cancelled has no business lingering on the landing page. `cache: "no-store"`
 * means every visit re-asks the calendar, which is also what quietly drops an
 * event once its day has gone by or someone has cancelled it — nothing here
 * has to notice that happened, the next fetch just doesn't include it.
 */
function useUpcomingEvents() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/api/events/upcoming`, { headers: { Accept: "application/json" }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data: UpcomingEvent[] } | null) => {
        if (!cancelled) setEvents(data?.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { events, loaded };
}

/* Every category the Secretary can file an event under (see Event::CATEGORIES
   in the backend) reads in one of the landing page's three existing event
   tones, same as the static "Past & Upcoming" reel above — an unrecognised
   category still renders, just neutrally. */
const CATEGORY_TONE: Record<string, EventTone> = {
  Meeting: "slate",
  Seminar: "slate",
  Workshop: "amber",
  Competition: "red",
  "Major Event": "red",
  "General Assembly": "slate",
  Deadline: "amber",
  Other: "slate",
};

function toneFor(category: string): EventTone {
  return CATEGORY_TONE[category] ?? "slate";
}

const toneHex: Record<EventTone, string> = {
  red: "#dc2626",
  amber: "#f59e0b",
  slate: "#64748b",
};

/* The "today" marker — a solid dateline stamp, not a pill with an icon and a
   heartbeat animation. Newspapers flag the story of the day with a filled
   label and nothing else; that reads as considered, where a pulsing glow
   reads as decoration standing in for a reason. Used only in the compact
   brief rows, where there's no room for the lead story's full watermark
   treatment below. */
function TodayStamp({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center bg-primary px-2.5 py-1 font-head text-[11px] font-bold uppercase tracking-[0.25em] text-primary-foreground ${className}`}
    >
      Today
    </span>
  );
}

/* The lead story's "today" treatment: an oversized "TODAY" set behind the
   copy, its fill fading from the category's tone into nothing, softened with
   a touch of blur so it reads as texture rather than a second headline — a
   magazine cover's practice of running a giant pull-word behind the actual
   story, not a badge shouting for attention. A diagonal wash plus the same
   dot texture the gallery cards use sit behind the type for depth. All of it
   is decorative: the accessible "today" signal is the plain-text kicker in
   the real content layer, not this. */
function TodayWatermark({ hex }: { hex: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 hidden w-[74%] overflow-hidden sm:block"
    >
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(115deg, transparent 28%, ${hex}16 62%, ${hex}2c 100%)` }}
      />
      <div className="pat-dots absolute inset-0 opacity-50" />
      <div className="flex h-full items-center justify-end">
        <span
          className="translate-x-[8%] select-none whitespace-nowrap font-display leading-none font-black uppercase"
          style={{
            fontSize: "clamp(6.5rem, 19vw, 15rem)",
            backgroundImage: `linear-gradient(120deg, ${hex}85 10%, ${hex}28 55%, transparent 90%)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            filter: "blur(0.5px)",
          }}
        >
          Today
        </span>
      </div>
    </div>
  );
}

/* Meta line — date, time, venue — shared by the lead story and the brief
   rows below it, just at two different sizes. */
function EventMeta({ e, hex, size = "sm" }: { e: UpcomingEvent; hex: string; size?: "sm" | "base" }) {
  const text = size === "base" ? "text-sm" : "text-xs";
  const icon = size === "base" ? 14 : 12;
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-1.5 text-secondary-foreground ${text}`}>
      <span className="flex items-center gap-1.5">
        <Calendar size={icon} style={{ color: hex }} /> {e.timing === "today" ? "Today" : e.dateLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock size={icon} style={{ color: hex }} /> {e.timeLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <MapPin size={icon} style={{ color: hex }} /> {e.venue ?? "Venue to be announced"}
      </span>
    </div>
  );
}

/* The lead story — always the soonest event, whatever it is. Its kicker
   just states how soon in plain type ("Today", "Tomorrow", "In 3 days"); the
   loud part of a same-day story is the watermark behind it, not the kicker
   itself. Weight is otherwise carried by type and rule lines — no photo, no
   icon tile, nothing standing in for a picture that isn't there. The copy is
   kept to the left column so it never runs under the watermark's type. */
function LeadStory({ e }: { e: UpcomingEvent }) {
  const hex = toneHex[toneFor(e.category)];
  const isToday = e.timing === "today";

  return (
    <Reveal>
      <article
        className={`relative overflow-hidden rounded-2xl border border-line bg-card p-7 md:p-10 ${
          isToday ? "border-t-2 border-t-primary" : ""
        }`}
      >
        {isToday && <TodayWatermark hex={hex} />}

        <div className={`relative z-10 ${isToday ? "sm:max-w-[54%]" : ""}`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className="font-head text-xs font-semibold uppercase tracking-[0.3em]"
              style={{ color: hex }}
            >
              {e.timingLabel}
            </span>
            <span className="text-xs font-head uppercase tracking-[0.3em] text-muted-foreground">
              {e.category}
            </span>
          </div>

          <h3 className="mt-5 font-display text-3xl font-black uppercase leading-[0.95] tracking-wide md:text-5xl">
            {e.title}
          </h3>

          <div className="mt-6 h-px w-24" style={{ background: `linear-gradient(90deg, ${hex}, transparent)` }} />

          <div className="mt-6">
            <EventMeta e={e} hex={hex} size="base" />
          </div>

          <p className="mt-6 leading-relaxed text-secondary-foreground">
            {e.description || "Details coming soon — check back for updates."}
          </p>
        </div>
      </article>
    </Reveal>
  );
}

/* One row of the "Next Up" index below the lead story — a newspaper table of
   contents, not a card grid: a faint numeral, a kicker, a headline, a meta
   line, and a thin rule separating it from the next row. */
function BriefRow({ e, index }: { e: UpcomingEvent; index: number }) {
  const hex = toneHex[toneFor(e.category)];

  return (
    <Reveal delay={Math.min(index, 8) * 0.05}>
      <article className="group grid grid-cols-[2.5rem_1fr_auto] items-start gap-4 py-6 md:grid-cols-[3.5rem_1fr_auto] md:gap-8 md:py-7">
        <span
          className="select-none font-display text-3xl font-black leading-none tabular-nums opacity-20 md:text-4xl"
          style={{ color: hex }}
        >
          {String(index + 2).padStart(2, "0")}
        </span>

        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-3">
            <span
              className="font-head text-[11px] font-semibold uppercase tracking-[0.25em]"
              style={{ color: hex }}
            >
              {e.category}
            </span>
            {e.timing === "today" && <TodayStamp className="px-2! py-0.5! text-[10px]!" />}
          </div>

          <h4 className="font-display text-lg font-bold uppercase leading-snug tracking-wide transition-colors group-hover:text-primary md:text-xl">
            {e.title}
          </h4>

          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-secondary-foreground">
            {e.description || "Details coming soon — check back for updates."}
          </p>

          <div className="mt-3">
            <EventMeta e={e} hex={hex} />
          </div>
        </div>

        <ArrowUpRight
          size={20}
          className="mt-1 hidden shrink-0 text-muted-foreground transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary sm:block"
        />
      </article>
    </Reveal>
  );
}

/* The right-hand "spine label" — a vertical progress rail plus a click target
   that pages through the list, so a reader isn't limited to grabbing the
   scrollbar or hunting for it with the wheel. The thumb tracks real scroll
   position via motion's useScroll rather than a manual scroll listener +
   setState, so it costs nothing extra on every scroll tick. Hidden on mobile,
   where the panel is short enough to thumb-scroll directly. */
function ScrollRail({
  progress,
  onStep,
  onJump,
}: {
  progress: MotionValue<number>;
  onStep: (dir: 1 | -1) => void;
  onJump: () => void;
}) {
  const thumbTop = useTransform(progress, [0, 1], ["0%", "78%"]);

  return (
    <div className="mt-2 hidden shrink-0 flex-col items-center gap-5 md:flex md:w-12 md:pt-3">
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label="Scroll up through events"
        className="text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronUp size={18} />
      </button>

      <button
        type="button"
        onClick={onJump}
        className="group flex flex-col items-center gap-3"
        aria-label="Explore more events"
      >
        <span className="[writing-mode:vertical-rl] font-head text-[10px] font-semibold uppercase tracking-[0.35em] text-muted-foreground transition-colors group-hover:text-primary">
          Explore Events
        </span>
        <span className="relative h-24 w-px overflow-hidden rounded-full bg-line">
          <motion.span
            aria-hidden
            className="absolute left-1/2 w-0.75 -translate-x-1/2 rounded-full bg-primary shadow-glow-sm"
            style={{ height: "22%", top: thumbTop }}
          />
        </span>
      </button>

      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label="Scroll down through events"
        className="text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronDown size={18} className="chevron-bounce" />
      </button>
    </div>
  );
}

/* The scrollable "Next Up" index: a fixed-height, internally scrolling panel
   with the browser scrollbar hidden and its own gradient fades standing in
   for one. `overscrollBehavior: "contain"` is what keeps the scroll confined
   to the panel — once the wheel reaches either end it simply stops there
   instead of handing the gesture on to the page, without trapping the visitor
   the way a full scroll-jack would. */
function EventsIndex({ events }: { events: UpcomingEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);
  const { scrollYProgress } = useScroll({ container: scrollRef });
  const topFade = useTransform(scrollYProgress, [0, 0.04], [0, 1]);
  const bottomFade = useTransform(scrollYProgress, [0.9, 1], [1, 0]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () => setScrollable(el.scrollHeight > el.clientHeight + 4);
    check();

    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [events.length]);

  /* The page runs a global Lenis smooth-scroll layer (see SmoothScroll.tsx)
     that listens for wheel events on `window` and, by default, redirects them
     into its own scroll animation — `data-lenis-prevent` on the panel below
     is meant to make it skip this element, but leaving the actual scrolling
     to "the browser's default action, assuming nothing upstream intercepted
     it" is exactly the kind of thing that quietly breaks. This drives the
     panel's scroll position directly instead: `preventDefault` stops the
     browser's own default handling, `stopPropagation` stops the event from
     ever reaching Lenis's listener, and the scrollTop write is what actually
     moves the list. Nothing else gets a vote in whether this scrolls. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      el.scrollTop += event.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const step = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * Math.round(el.clientHeight * 0.55), behavior: "smooth" });
  };

  const jump = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    el.scrollTo({ top: atBottom ? 0 : el.scrollTop + el.clientHeight * 0.7, behavior: "smooth" });
  };

  return (
    <div className="mt-2 md:flex md:items-start md:gap-2">
      <div className="relative min-w-0 flex-1">
        {scrollable && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-background to-transparent"
            style={{ opacity: topFade }}
          />
        )}

        <div
          ref={scrollRef}
          data-lenis-prevent
          className="no-scrollbar divide-y divide-line overflow-y-auto border-t border-line"
          style={{ maxHeight: PANEL_MAX_HEIGHT, overscrollBehavior: "contain" }}
        >
          {events.map((e, i) => (
            <BriefRow key={e.id} e={e} index={i} />
          ))}
        </div>

        {scrollable && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-linear-to-t from-background to-transparent"
            style={{ opacity: bottomFade }}
          />
        )}
      </div>

      {scrollable && <ScrollRail progress={scrollYProgress} onStep={step} onJump={jump} />}
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="rounded-2xl border border-line bg-card p-7 md:p-10">
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton mt-5 h-10 w-3/4 rounded md:h-12" />
        <div className="skeleton mt-6 h-4 w-64 rounded" />
        <div className="skeleton mt-4 h-16 w-full max-w-2xl rounded" />
      </div>
      <div className="mt-2 divide-y divide-line border-t border-line">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[3.5rem_1fr] gap-8 py-7">
            <div className="skeleton h-9 w-9 rounded" />
            <div>
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton mt-2 h-6 w-2/3 rounded" />
              <div className="skeleton mt-3 h-4 w-full max-w-md rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The landing page's live tie-in to the internal Schedules module — every
 * event the Secretary or Assistant Secretary has on the calendar that hasn't
 * happened yet, read as an editorial "next up" index rather than a calendar
 * grid or a row of photo cards: the schedule carries no images, so the
 * section is built from type and rule lines instead of standing anything in
 * for a picture that isn't there.
 *
 * A cancelled, completed, or past-dated event is never sent by the API in the
 * first place (see UpcomingEventsController), so there is nothing to filter
 * out here beyond deciding how the soonest event is drawn.
 *
 * Renders nothing once loaded with an empty list — a quiet landing page beats
 * an empty "Upcoming Events" block with nothing to show.
 */
export default function UpcomingEvents() {
  const { events, loaded } = useUpcomingEvents();

  if (loaded && events.length === 0) return null;

  const [lead, ...rest] = events;

  return (
    <section id="upcoming-events" className="relative border-t border-line/60 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <SectionHeading
          kicker="Mark Your Calendar"
          title="Upcoming Events"
          sub="Straight from the Secretariat's schedule — every seminar, workshop, and gathering ICPEP has lined up next, live the moment it's announced."
        />

        {!loaded ? (
          <LoadingState />
        ) : (
          <div>
            <LeadStory e={lead} />
            {rest.length > 0 && <EventsIndex events={rest} />}
          </div>
        )}
      </div>
    </section>
  );
}
