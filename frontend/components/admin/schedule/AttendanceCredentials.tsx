"use client";

/* An event's attendance credentials — the QR officers scan, the short code for
   whoever cannot — and the link that shares both.

   The QR and code are minted by the backend as the event row is inserted, so
   this only displays them. The share link is different: it is minted on
   request, because a link that exists is a link that can leak and most events
   are never shared at all.

   Sharing is refused once the event is closed or its day has gone by. The
   button here reflects that, and the backend enforces it again — the public
   page re-checks on every request, so a link already sent dies with the event
   rather than outliving it. */

import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  MapPin,
  QrCode,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { apiSend } from "@/lib/adminApi";
import type { ScheduledEvent } from "@/lib/adminTypes";

/** A copy-to-clipboard button that says so for a moment afterwards — or, if
    the browser refused the write (insecure origin, permission, browser
    policy), says that instead rather than claiming success. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
    >
      {status === "idle" && <Copy size={12} />}
      {status === "copied" && <Check size={12} className="text-green-400" />}
      {status === "error" && <TriangleAlert size={12} className="text-red-400" />}
      {status === "idle" ? label : status === "copied" ? "Copied" : "Couldn't copy"}
    </button>
  );
}

export default function AttendanceCredentials({
  event,
  onShared,
  className = "",
}: {
  event: ScheduledEvent;
  /** Hands back the event with its new share link, so the modal can show it. */
  onShared: (updated: ScheduledEvent) => void;
  /**
   * Extra classes on the card itself — namely `flex-1` from EventModal, so
   * this is the card whose border grows to close the gap when the Status &
   * QR tab has less to show than the fields beside it, rather than leaving
   * empty space below a card that stopped at its own natural size.
   */
  className?: string;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!event.qrUrl || !event.attendanceCode) return null;

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      onShared(await apiSend<ScheduledEvent>("POST", `/events/${event.id}/share`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    // `min-w-0`: this is a flex item in EventSidePanel's column, and without it
    // the share link below — one unbroken string, nowhere to wrap — sets the
    // card's own minimum width instead of letting `truncate` clip it, pushing
    // the whole form wider than the screen on a phone.
    <div className={`min-w-0 rounded-lg border border-line bg-secondary/30 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-head text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          <QrCode size={13} /> Attendance
        </p>
        {/* The QR and the code are only good up to and including the event's
            day. Said here because they stay on screen after they stop working,
            and a code that looks live but is not is worse than no code. */}
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
            event.acceptsAttendance
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : "border-line bg-secondary/60 text-muted-foreground"
          }`}
        >
          {event.acceptsAttendance ? "Active" : "Expired"}
        </span>
      </div>

      {event.venue && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-secondary-foreground">
          <MapPin size={12} className="shrink-0 text-primary" /> {event.venue}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {/* On white, always. A QR inverted onto a dark card is rejected by a
            good many phone scanners, and this one gets held up in a room. */}
        <div className={`rounded-lg bg-white p-2 ${event.acceptsAttendance ? "" : "opacity-40"}`}>
          <QRCodeSVG value={event.qrUrl} size={104} level="M" marginSize={0} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">Or enter this code</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-[0.25em] text-foreground">
            {event.attendanceCode}
          </p>
          <div className="mt-2">
            <CopyButton value={event.attendanceCode} label="Copy code" />
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-line/60 pt-3">
        {event.shareUrl && event.canShare ? (
          <>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Link2 size={12} className="text-primary" /> Share link
            </p>
            <p className="mt-1.5 truncate rounded-md border border-line bg-background/60 px-2.5 py-1.5 font-mono text-[11px] text-secondary-foreground">
              {event.shareUrl}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CopyButton value={event.shareUrl} label="Copy link" />
              <a
                href={event.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <ExternalLink size={12} /> Open
              </a>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              Anyone with this link sees the event details, the QR and the code —
              no sign-in needed. It is revoked the moment the event is marked
              done or cancelled, or once its day has passed, and reopening the
              event does not bring it back.
            </p>
          </>
        ) : event.canShare ? (
          <>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/10 disabled:opacity-70"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
              Create share link
            </button>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {/* The replacement warning only appears when there is actually a
                  revoked link behind it — the first share of an event should
                  not be warned about a predecessor that never existed. */}
              {event.shareRevoked
                ? "This event had a link that was revoked. Creating one now issues a different URL; the old one stays dead."
                : "Makes a page anyone can open — details, QR and code — without an account."}
            </p>
          </>
        ) : (
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <Lock size={12} className="mt-0.5 shrink-0" />
            {/* The backend's own words, so the button and the page that refuses
                a stale link never tell different stories. */}
            {event.shareBlockedReason ?? "This event can no longer be shared."}
            {event.shareRevoked ? " Any link already sent has stopped working for good." : ""}
          </p>
        )}

        {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}