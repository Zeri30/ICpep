"use client";

/* The public page behind a share link.

   Whoever opens this is standing in a room with a phone, or looking at it
   projected on a wall. So the two things they came for — the QR and the code —
   are the largest elements on the page and never below the fold on a phone,
   and everything else is the context needed to be sure it is the right event.

   A client component only because the QR renders here and the code can be
   copied; it is still server-rendered on first paint, so the QR is in the HTML
   rather than appearing after hydration. */

import {
  CalendarDays,
  Check,
  Clock,
  Copy,
  Link2,
  MapPin,
  QrCode,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { useState, type ComponentType } from "react";
import { QRCodeSVG } from "qrcode.react";
import Logo from "@/components/ui/Logo";

export type SharedEventData = {
  available: true;
  title: string;
  category: string;
  venue: string | null;
  date: string;
  dateLabel: string;
  timeLabel: string;
  timingLabel: string;
  timing: "upcoming" | "today" | "past";
  description: string | null;
  organization: string;
  timezone: string;
  qrUrl: string;
  attendanceCode: string;
};

/** "2026-11-03" → the day number and the month, for the date tile. */
function splitDate(date: string): { day: string; month: string; year: string } {
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return {
    day: String(d),
    month: local.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    year: String(y),
  };
}

type ActionStatus = "idle" | "done" | "error";

/** One of the three share actions below the code: an icon-and-label button
    that flashes to a check or a warning for a couple of seconds, then reverts.
    A shared button rather than three copies, since all three only differ in
    icon, label and what "done" is called. */
function ShareActionButton({
  status,
  onClick,
  icon: Icon,
  label,
  doneLabel,
  errorLabel,
}: {
  status: ActionStatus;
  onClick: () => void;
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  doneLabel: string;
  errorLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-line px-4 py-2 font-head text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {status === "idle" && <Icon size={12} />}
      {status === "done" && <Check size={12} className="text-green-400" />}
      {status === "error" && <TriangleAlert size={12} className="text-red-400" />}
      {status === "idle" ? label : status === "done" ? doneLabel : errorLabel}
    </button>
  );
}

export default function SharedEvent({ event }: { event: SharedEventData }) {
  const { day, month, year } = splitDate(event.date);
  const isToday = event.timing === "today";

  const [linkStatus, setLinkStatus] = useState<ActionStatus>("idle");
  const [codeStatus, setCodeStatus] = useState<ActionStatus>("idle");

  // Each flashes its own button to "done" or "error" for a couple of seconds,
  // then reverts. Clipboard writes can be refused (insecure origin,
  // permission, browser policy) and the failure has to say so rather than
  // claim success or throw past the click handler.

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkStatus("done");
    } catch {
      setLinkStatus("error");
    }
    setTimeout(() => setLinkStatus("idle"), 2500);
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(event.attendanceCode);
      setCodeStatus("done");
    } catch {
      setCodeStatus("error");
    }
    setTimeout(() => setCodeStatus("idle"), 2500);
  }


  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Same furniture as the landing page, so a link that leaves the admin
          still plainly belongs to the organization that sent it. */}
      <div className="pointer-events-none absolute inset-0 pat-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.16),transparent_60%)]" />

      {/* One pass, stacked on a phone (tall is fine there — it's read
          top-to-bottom in one hand) and laid on its side from `lg` up, so a
          wide screen gets a wide card instead of a narrow column adrift in
          empty margins. Still stacked through `sm` — that width is enough to
          read comfortably wider than the phone size, but not enough to split
          in two without cramping the QR. The two halves are still one
          bordered box either way — see below for why that's what keeps them
          in step regardless of description length. */}
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8 sm:max-w-xl sm:px-6 lg:max-w-4xl lg:py-12 2xl:max-w-5xl">
        <header className="flex items-center gap-3">
          <Logo size={40} priority />
          <div className="leading-tight">
            <p className="font-display text-sm font-black tracking-wide text-foreground">
              {event.organization}
            </p>
            <p className="font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              BulSU Meneses Campus
            </p>
          </div>
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-head text-[10px] font-semibold uppercase tracking-[0.15em] ${
              isToday
                ? "border-primary/50 bg-primary/15 text-primary pulse-ring"
                : "border-line bg-secondary/50 text-secondary-foreground"
            }`}
          >
            <Clock size={12} /> {event.timingLabel}
          </span>
        </header>

        <div className="flex flex-1 items-center">
          {/* One card, like a boarding pass: event info on one side, the
              dashed stub-line, how-to-check-in on the other. Capped height
              on `lg` — a sensible ceiling based on the viewport, not
              something a long description gets to redefine — and both
              sides are flex items of the same stretched row, which is what
              keeps them the same height for free without either one
              needing to know the other's size. */}
          <div className="w-full overflow-hidden rounded-2xl border border-line bg-card lg:flex lg:max-h-[min(40rem,82dvh)] lg:items-stretch">
            {/* ------------------------------------------------ what and when */}
            <div className="relative flex flex-col p-6 sm:p-8 lg:w-[58%]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-glow to-transparent lg:inset-y-0 lg:right-auto lg:h-auto lg:w-1 lg:bg-gradient-to-b" />

              {/* Top: identity — fixed size, never what varies between events. */}
              <div className="shrink-0">
                <p className="font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Event type
                </p>
                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-head text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                  {event.category}
                </span>

                <p className="mt-5 font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Event title
                </p>
                <h1 className="mt-1.5 font-display text-2xl font-black uppercase leading-tight tracking-wide text-foreground sm:text-3xl lg:text-4xl">
                  {event.title}
                </h1>

                <p className="mt-5 font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Schedule
                </p>
                <div className="mt-1.5 flex flex-wrap gap-3">
                  {/* The date as a tear-off calendar tile — readable across a room
                      in a way a line of text is not. */}
                  <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-secondary/40">
                    <div className="grid place-items-center bg-primary px-4 py-3 text-white">
                      <span className="font-display text-2xl font-black leading-none">{day}</span>
                      <span className="mt-0.5 font-head text-[10px] font-bold uppercase tracking-widest">
                        {month}
                      </span>
                    </div>
                    <div className="flex flex-col justify-center px-4 py-3">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <CalendarDays size={14} className="text-primary" /> {event.dateLabel}
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-secondary-foreground">
                        <Clock size={14} className="text-primary" /> {event.timeLabel}
                      </span>
                      {event.venue && (
                        <span className="mt-1 flex items-center gap-1.5 text-sm text-secondary-foreground">
                          <MapPin size={14} className="text-primary" /> {event.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: the one field with no natural length limit, so it is
                  the one thing that grows to take up whatever room is left
                  and scrolls past that rather than the card growing with it.
                  A bordered box rather than bare text, so room left over
                  under a short note reads as "a text box with space in it"
                  and not as a stray gap in the layout. */}
              <div className="mt-5 flex min-h-0 flex-col border-t border-line/60 pt-4 lg:mt-6 lg:flex-1 lg:pt-5">
                <p className="shrink-0 font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Description
                </p>
                <div className="mt-2 max-h-40 min-h-16 overflow-y-auto rounded-lg border border-line/60 bg-secondary/20 p-3 pr-2.5 sm:max-h-48 lg:max-h-none lg:min-h-0 lg:flex-1">
                  {event.description ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">
                      {event.description}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      No additional details for this event.
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom: fixed size again, pinned under the description
                  regardless of how tall or short that box ends up. */}
              <div className="mt-5 shrink-0 border-t border-line/60 pt-4 lg:mt-6">
                <p className="font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Additional information
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin size={12} /> All times {event.timezone.replace("_", " ")} · {year}
                </p>
              </div>
            </div>

            {/* The stub line: a plain dashed rule reads as "tear here" without
                needing perforation notches that would have to be cut out of
                whatever happens to be behind the card. Horizontal while the
                two halves are stacked, vertical once they're side by side —
                and full-height there for free, since it's an empty flex item
                in the same stretched row as both halves. */}
            <div className="border-t border-dashed border-line lg:hidden" />
            <div className="hidden border-l border-dashed border-line lg:block" />

            {/* ----------------------------------------------- how to check in */}
            <div className="flex flex-col bg-secondary/20 p-6 text-center sm:p-8 lg:w-[42%]">
              {/* This half's content is fixed regardless of the event, so
                  `justify-center` is what happens to any extra height the row
                  stretch hands it — split evenly above and below, keeping the
                  QR visually centred in its column instead of pinned to the
                  top with dead space beneath it. Every element inside keeps
                  its own fixed spacing either way: it's the space around the
                  whole block that flexes, never the gaps within it. */}
              <div className="flex flex-1 flex-col justify-center">
                <p className="flex items-center justify-center gap-1.5 font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  <ScanLine size={13} /> Scan to check in
                </p>

                <div className="mt-5 flex justify-center">
                  {/* White tile, always: a QR inverted onto a dark card is refused
                      by a good many phone scanners, and this one is meant to be
                      scanned off a screen held at arm's length. */}
                  <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_rgba(220,38,38,0.15)] sm:p-5 lg:p-6">
                    <QRCodeSVG
                      value={event.qrUrl}
                      size={256}
                      level="M"
                      marginSize={0}
                      className="h-48 w-48 sm:h-52 sm:w-52 2xl:h-64 2xl:w-64"
                    />
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-secondary-foreground">
                  <span className="font-semibold text-foreground">Scan</span> the code with your phone
                  camera
                </p>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    or
                  </span>
                  <span className="h-px flex-1 bg-line" />
                </div>

                {/* The whole reason this exists: a camera that will not focus, a
                    denied permission, a cracked lens. */}
                <p className="text-center text-xs text-secondary-foreground">
                  Enter this code instead
                </p>
                <div className="mt-2 rounded-xl border border-line bg-card px-4 py-4 text-center sm:px-6 sm:py-5">
                  <p className="font-mono text-3xl font-black tracking-[0.3em] text-foreground sm:text-4xl">
                    {event.attendanceCode}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <ShareActionButton
                    status={linkStatus}
                    onClick={copyLink}
                    icon={Link2}
                    label="Copy link"
                    doneLabel="Link copied"
                    errorLabel="Couldn't copy"
                  />
                  <ShareActionButton
                    status={codeStatus}
                    onClick={copyCode}
                    icon={Copy}
                    label="Copy code"
                    doneLabel="Code copied"
                    errorLabel="Couldn't copy"
                  />
                </div>

                {linkStatus === "error" && (
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-red-400">
                    Unable to copy automatically. Copy this link manually:{" "}
                    <span className="break-all font-mono text-foreground">{window.location.href}</span>
                  </p>
                )}
                {codeStatus === "error" && (
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-red-400">
                    Unable to copy automatically. Please copy the code above manually.
                  </p>
                )}

                <p className="mt-5 flex items-start gap-1.5 border-t border-line/60 pt-4 text-left text-[11px] leading-relaxed text-muted-foreground">
                  <QrCode size={12} className="mt-0.5 shrink-0" />
                  Both are unique to this event. This page stops working once the
                  event is marked done or cancelled, or after its day has passed.
                </p>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-center font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {event.organization} · Institute of Computer Engineers of the Philippines
        </footer>
      </div>
    </main>
  );
}