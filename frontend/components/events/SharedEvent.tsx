"use client";

/* The public page behind a share link.

   Whoever opens this is standing in a room with a phone, or looking at it
   projected on a wall. So the two things they came for — the QR and the code —
   are the largest elements on the page and never below the fold on a phone,
   and everything else is the context needed to be sure it is the right event.

   A client component only because the QR renders here and the code can be
   copied; it is still server-rendered on first paint, so the QR is in the HTML
   rather than appearing after hydration. */

import { CalendarDays, Check, Clock, Copy, MapPin, QrCode, ScanLine } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Logo from "@/components/ui/Logo";

export type SharedEventData = {
  available: true;
  title: string;
  category: string;
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

export default function SharedEvent({ event }: { event: SharedEventData }) {
  const [copied, setCopied] = useState(false);
  const { day, month, year } = splitDate(event.date);
  const isToday = event.timing === "today";

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(event.attendanceCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused on an insecure origin. The code is on
      // screen in large type either way.
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Same furniture as the landing page, so a link that leaves the admin
          still plainly belongs to the organization that sent it. */}
      <div className="pointer-events-none absolute inset-0 pat-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.16),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-12">
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

        <div className="mt-8 grid flex-1 items-start gap-6 lg:mt-10 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ------------------------------------------------ what and when */}
          <section className="relative overflow-hidden rounded-2xl border border-line bg-card p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-glow to-transparent" />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-head text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
              {event.category}
            </span>

            <h1 className="mt-4 font-display text-3xl font-black uppercase leading-tight tracking-wide text-foreground sm:text-4xl">
              {event.title}
            </h1>

            <div className="mt-6 flex flex-wrap gap-3">
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
                </div>
              </div>
            </div>

            {event.description && (
              <div className="mt-6 border-t border-line/60 pt-5">
                <p className="font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Details
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">
                  {event.description}
                </p>
              </div>
            )}

            <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin size={12} /> All times {event.timezone.replace("_", " ")} · {year}
            </p>
          </section>

          {/* ----------------------------------------------- how to check in */}
          <section className="rounded-2xl border border-line bg-card p-6 sm:p-8">
            <p className="flex items-center gap-1.5 font-head text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <ScanLine size={13} /> Attendance
            </p>

            <div className="mt-5 flex justify-center">
              {/* White tile, always: a QR inverted onto a dark card is refused
                  by a good many phone scanners, and this one is meant to be
                  scanned off a screen held at arm's length. */}
              <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_rgba(220,38,38,0.15)]">
                <QRCodeSVG value={event.qrUrl} size={190} level="M" marginSize={0} />
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
            <div className="mt-2 rounded-xl border border-line bg-secondary/40 px-4 py-4 text-center">
              <p className="font-mono text-3xl font-black tracking-[0.3em] text-foreground sm:text-4xl">
                {event.attendanceCode}
              </p>
            </div>
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-head text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy code"}
              </button>
            </div>

            <p className="mt-5 flex items-start gap-1.5 border-t border-line/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
              <QrCode size={12} className="mt-0.5 shrink-0" />
              Both are unique to this event. This page stops working once the
              event is marked done or cancelled, or after its day has passed.
            </p>
          </section>
        </div>

        <footer className="mt-8 text-center font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {event.organization} · Institute of Computer Engineers of the Philippines
        </footer>
      </div>
    </main>
  );
}
