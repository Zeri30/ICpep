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
  Download,
  Link2,
  MapPin,
  QrCode,
  ScanLine,
  TriangleAlert,
} from "lucide-react";
import { useRef, useState, type ComponentType } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
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

/** An event's title, as a download filename — lowercase, hyphenated, never empty. */
function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "event";
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
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [linkStatus, setLinkStatus] = useState<ActionStatus>("idle");
  const [codeStatus, setCodeStatus] = useState<ActionStatus>("idle");
  const [qrStatus, setQrStatus] = useState<ActionStatus>("idle");

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

  function downloadQr() {
    try {
      const canvas = qrCanvasRef.current;
      if (!canvas) throw new Error("QR canvas not ready");
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${slugify(event.title)}-attendance-qr.png`;
      link.click();
      setQrStatus("done");
    } catch {
      setQrStatus("error");
    }
    setTimeout(() => setQrStatus("idle"), 2500);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* Same furniture as the landing page, so a link that leaves the admin
          still plainly belongs to the organization that sent it. */}
      <div className="pointer-events-none absolute inset-0 pat-grid opacity-40" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.16),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-8 sm:px-6 lg:py-12 2xl:max-w-6xl">
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

        {/* `items-center` on this flex wrapper (not the grid inside it) shares
            leftover vertical space above and below the two cards instead of
            dumping it all beneath them, which otherwise reads as a lopsided
            gap before the footer on a tall desktop viewport. */}
        <div className="mt-8 flex flex-1 items-center lg:mt-10">
          <div className="grid w-full items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
            {/* ------------------------------------------------ what and when */}
            <section className="relative overflow-hidden rounded-2xl border border-line bg-card p-6 sm:p-8">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-glow to-transparent" />

              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-head text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                {event.category}
              </span>

              <h1 className="mt-4 font-display text-3xl font-black uppercase leading-tight tracking-wide text-foreground sm:text-4xl lg:text-5xl">
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
                    scanned off a screen held at arm's length. Padding (the
                    quiet zone) and the tile itself both grow with the
                    viewport, so it reads just as reliably held up to a
                    projector screen. */}
                <div className="rounded-2xl bg-white p-4 shadow-[0_10px_40px_rgba(220,38,38,0.15)] sm:p-5 lg:p-6">
                  <QRCodeSVG
                    value={event.qrUrl}
                    size={256}
                    level="M"
                    marginSize={0}
                    className="h-48 w-48 sm:h-52 sm:w-52 lg:h-60 lg:w-60 2xl:h-72 2xl:w-72"
                  />
                </div>
              </div>

              {/* Off-screen but still rendered: qrcode.react draws to this
                  canvas regardless of its CSS visibility, so a PNG is ready
                  the moment Download is pressed. A canvas rather than the
                  visible SVG because only a canvas can hand back pixels via
                  toDataURL — same value and level, so it's the same code,
                  just a different render target. A wider margin than the
                  on-page SVG's because this copy has no white card around it
                  once it leaves the page. */}
              <QRCodeCanvas
                ref={qrCanvasRef}
                value={event.qrUrl}
                size={512}
                level="M"
                marginSize={4}
                className="hidden"
              />

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
              <div className="mt-2 rounded-xl border border-line bg-secondary/40 px-4 py-4 text-center sm:px-6 sm:py-5">
                <p className="font-mono text-3xl font-black tracking-[0.3em] text-foreground sm:text-4xl lg:text-5xl 2xl:text-6xl">
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
                <ShareActionButton
                  status={qrStatus}
                  onClick={downloadQr}
                  icon={Download}
                  label="Download QR"
                  doneLabel="Downloaded"
                  errorLabel="Couldn't download"
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
              {qrStatus === "error" && (
                <p className="mt-2 text-center text-[11px] leading-relaxed text-red-400">
                  Unable to download automatically. Try again, or screenshot the QR above.
                </p>
              )}

              <p className="mt-5 flex items-start gap-1.5 border-t border-line/60 pt-4 text-[11px] leading-relaxed text-muted-foreground">
                <QrCode size={12} className="mt-0.5 shrink-0" />
                Both are unique to this event. This page stops working once the
                event is marked done or cancelled, or after its day has passed.
              </p>
            </section>
          </div>
        </div>

        <footer className="mt-8 text-center font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {event.organization} · Institute of Computer Engineers of the Philippines
        </footer>
      </div>
    </main>
  );
}
