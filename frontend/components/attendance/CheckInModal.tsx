"use client";

/* Recording that you are here — as one modal instead of a page with its own
   form, so it can be opened from wherever an officer already is (the topbar's
   QR button, an event's "check in with a code" link) rather than sending them
   away to get there.

   Three ways in, one modal:
   - A token already in hand, via the `token` prop — /admin/check-in?token=…
     hands this in from the URL a phone's camera app opened. That path is
     fixed (see Event::checkInUrl()) and stays a real page for exactly that
     reason: an already-printed QR can't be redirected to a modal.
   - Scanning inside the modal itself, with this app's own camera — the QR's
     token is read and submitted in place, no navigation at all.
   - Typing the six-character code, reachable from the scan view or landed on
     directly when a token turns out no good.

   All three converge on the same `checkIn` call and the same done/closed
   result screens, so which door you came through stops mattering the moment
   you're in. */

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Clock,
  KeyRound,
  Loader2,
  MapPin,
  QrCode,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QrScanner from "qr-scanner";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { ApiError, apiGet, apiSend } from "@/lib/adminApi";
import type { CheckInState } from "@/lib/adminTypes";

/** How long the code is — the field is sized and validated against this. */
const CODE_LENGTH = 6;

/**
 * The alphabet the backend draws codes from — no 0 *or* O, no 1, I or L,
 * because the code is read aloud across a room and typed on a phone.
 *
 * ⚠ Mirrors Event::CODE_ALPHABET. A character added there and not here would
 * become untypable.
 */
const CODE_ALPHABET = /[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g;

/** Fixed, per Event::checkInUrl()'s own warning — a QR that decodes anywhere else isn't one of ours. */
const CHECK_IN_PATH = "/admin/check-in";

/** The token in a scanned QR's own URL, or null if it isn't one of ours. */
function checkInTokenOrNull(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && url.pathname === CHECK_IN_PATH
      ? url.searchParams.get("token")
      : null;
  } catch {
    return null;
  }
}

type Phase =
  /** Resolving a token handed in as a prop. */
  | "resolving"
  /** Recording the check-in. */
  | "submitting"
  /** The camera, looking for a QR. */
  | "scan"
  /** Waiting for a code to be typed. */
  | "manual"
  /** Done: on the record. */
  | "done"
  /** The event is over, cancelled, or its day has passed. */
  | "closed";

export default function CheckInModal({
  open,
  token = null,
  initialMode = "scan",
  onClose,
}: {
  open: boolean;
  /** A token already in hand — see the file comment's first way in. */
  token?: string | null;
  /**
   * Which no-token view opens first. `manual` for an entry point that only
   * ever offered a code in the first place — see MyAttendance in
   * EventModal, whose "Check in with a code" button has nothing to do with
   * the camera and shouldn't make someone click past it to get to the field.
   */
  initialMode?: "scan" | "manual";
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(token ? "resolving" : initialMode);
  const [state, setState] = useState<CheckInState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Whether `manual` was reached because a token failed, rather than chosen
  // — CodeForm reads differently depending on which ("that QR could not be
  // used" versus just asking for the code).
  const [tokenFailed, setTokenFailed] = useState(false);

  const attemptedToken = useRef<string | null>(null);

  const checkIn = useCallback(async (body: { token: string } | { code: string }) => {
    setPhase("submitting");
    setError(null);

    try {
      const result = await apiSend<CheckInState>("POST", "/check-in", body);
      setState(result);
      setPhase(result.accepted ? "done" : "closed");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not record your attendance.";

      if (e instanceof ApiError && e.status === 404) {
        setError("This check-in link is not valid. Enter the code instead.");
      } else {
        setError(message);
      }
      setTokenFailed("token" in body);
      setPhase("manual");
    }
  }, []);

  // Resolve a token handed in as a prop. Asked about before recording, so an
  // expired QR is answered with "this event has already passed" rather than
  // a validation error about a token.
  useEffect(() => {
    if (!open || !token || attemptedToken.current === token) return;
    attemptedToken.current = token;

    (async () => {
      try {
        const resolved = await apiGet<CheckInState>(
          `/check-in?token=${encodeURIComponent(token)}`,
        );
        setState(resolved);

        if (!resolved.accepted) return setPhase("closed");
        // Already on the record — from an earlier scan, or the Secretary
        // ticked them off. Nothing to send.
        if (resolved.status === "present") {
          setState({ ...resolved, alreadyCheckedIn: true });
          return setPhase("done");
        }

        await checkIn({ token });
      } catch {
        setError("This check-in link is not valid. Enter the code instead.");
        setTokenFailed(true);
        setPhase("manual");
      }
    })();
  }, [open, token, checkIn]);

  // Fresh every time the modal is opened with nothing in hand — otherwise
  // reopening it after an earlier check-in would still be sitting on that
  // one's "done" screen.
  useEffect(() => {
    if (!open || token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets transient state on reopen, not a per-render loop; only fires when `open`/`token`/`initialMode` change
    setPhase(initialMode);
    setState(null);
    setCode("");
    setError(null);
    setTokenFailed(false);
    attemptedToken.current = null;
  }, [open, token, initialMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      return setError(`The code is ${CODE_LENGTH} characters.`);
    }
    checkIn({ code });
  }

  function enterCodeManually() {
    setError(null);
    setTokenFailed(false);
    setPhase("manual");
  }

  function backToScan() {
    setError(null);
    setCode("");
    setPhase("scan");
  }

  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label="Attendance check-in"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
                className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
              >
                <div className="flex items-center justify-between border-b border-line/60 p-4">
                  <h2 className="font-display text-base font-black uppercase tracking-wide text-foreground">
                    Attendance
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="p-5">
                  {phase === "resolving" || phase === "submitting" ? (
                    <Working label={phase === "resolving" ? "Reading the code…" : "Checking you in…"} />
                  ) : phase === "done" && state ? (
                    <Recorded state={state} />
                  ) : phase === "closed" && state ? (
                    <Closed state={state} />
                  ) : phase === "manual" ? (
                    <CodeForm
                      value={code}
                      error={error}
                      scanned={tokenFailed}
                      onChange={setCode}
                      onSubmit={submitCode}
                      onBackToScan={backToScan}
                    />
                  ) : (
                    <Scanner open={open} onDecoded={(t) => checkIn({ token: t })} onManual={enterCodeManually} />
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * The camera view. A component of its own so the scanning effect only ever
 * runs while this is actually what's on screen — mounted for the `scan`
 * phase alone, torn down (and the camera released) the moment the modal
 * moves to any other phase or closes.
 */
function Scanner({
  open,
  onDecoded,
  onManual,
}: {
  open: boolean;
  /** A validated token, ready to submit — never a raw scan result. */
  onDecoded: (token: string) => void;
  onManual: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [starting, setStarting] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  // A readable QR that just isn't one of ours. Scanning keeps running through
  // it — unlike a permission failure, there's nothing here to stop for.
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    setStarting(true);
    setPermissionError(null);
    setMismatch(false);

    let mismatchTimer: ReturnType<typeof setTimeout> | undefined;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const token = checkInTokenOrNull(result.data);
        if (!token) {
          setMismatch(true);
          clearTimeout(mismatchTimer);
          mismatchTimer = setTimeout(() => setMismatch(false), 2500);
          return;
        }
        scanner.stop();
        onDecoded(token);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, preferredCamera: "environment" },
    );

    scanner
      .start()
      .then(() => setStarting(false))
      .catch(() => {
        setStarting(false);
        setPermissionError(
          "Could not access the camera. Check your browser's camera permission for this site, or enter the code instead.",
        );
      });

    return () => {
      clearTimeout(mismatchTimer);
      scanner.stop();
      scanner.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDecoded is stable enough for a scan session; re-subscribing on every render would restart the camera
  }, [open]);

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-black">
        {/* Kept mounted under the error states rather than swapped out, so a
            stream already open is not torn down and re-requested if
            permission was only granted a moment late. */}
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {starting && !permissionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-xs text-secondary-foreground">Starting the camera…</p>
          </div>
        )}

        {permissionError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/95 px-6 text-center">
            <AlertTriangle size={24} className="text-amber-accent" />
            <p className="text-xs leading-relaxed text-muted-foreground">{permissionError}</p>
          </div>
        )}

        {mismatch && !permissionError && (
          <div className="absolute inset-x-0 bottom-0 bg-amber-accent/15 px-4 py-2.5 text-center text-[11px] font-semibold text-amber-accent">
            That&apos;s not an ICpEP.SE attendance code.
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Point your camera at the event&apos;s QR code.
      </p>

      <button
        type="button"
        onClick={onManual}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-3 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <KeyRound size={15} /> Enter code manually
      </button>
    </div>
  );
}

function Working({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <Loader2 size={30} className="animate-spin text-primary" />
      <p className="mt-4 text-sm text-secondary-foreground">{label}</p>
    </div>
  );
}

/** The answer: you are on the record. */
function Recorded({ state }: { state: CheckInState }) {
  const again = state.alreadyCheckedIn === true;

  return (
    <div className="text-center">
      {/* The tick carries the answer on its own. Anyone who reads no further
          than the colour has still read it correctly. */}
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-green-500/15 text-green-400">
        <Check size={34} strokeWidth={3} />
      </span>

      <p className="mt-4 font-display text-xl font-black uppercase tracking-wide text-foreground">
        {again ? "Already checked in" : "You're checked in"}
      </p>

      {state.checkedInLabel && (
        <p className="mt-1 text-sm text-secondary-foreground">
          {again ? "Recorded at" : "At"} {state.checkedInLabel}
        </p>
      )}

      <EventCard state={state} />

      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        {again
          ? "Nothing changed — you were already on the roster for this event."
          : "The Secretary can see you on the roster. You can close this."}
      </p>
    </div>
  );
}

/** The event stopped taking attendance before this scan or code arrived. */
function Closed({ state }: { state: CheckInState }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-accent/15 text-amber-accent">
        <AlertTriangle size={30} />
      </span>

      <p className="mt-4 font-display text-xl font-black uppercase tracking-wide text-foreground">
        Not taking attendance
      </p>

      {/* The backend's own words, so a refused scan and the panel the
          Secretary is looking at never tell different stories. */}
      <p className="mt-1 text-sm text-secondary-foreground">
        {state.closedReason ?? "This event is no longer accepting check-ins."}
      </p>

      <EventCard state={state} />

      {state.status === "present" ? (
        <p className="mt-4 text-[11px] leading-relaxed text-green-400">
          You were checked in{state.checkedInLabel ? ` at ${state.checkedInLabel}` : ""}, so your
          attendance still stands.
        </p>
      ) : (
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Ask the Secretary to record your attendance on the roster.
        </p>
      )}
    </div>
  );
}

/** Which event this was, so nobody checks into the wrong one and never finds out. */
function EventCard({ state }: { state: CheckInState }) {
  return (
    <div className="mt-5 rounded-lg border border-line bg-secondary/30 p-3 text-left">
      <p className="truncate text-sm font-semibold text-foreground">{state.event.title}</p>
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarDays size={12} className="shrink-0" />
        {state.event.dateLabel}
      </p>
      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock size={12} className="shrink-0" />
        {state.event.timeRangeLabel}
      </p>
      {state.event.venue && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin size={12} className="shrink-0" />
          {state.event.venue}
        </p>
      )}
    </div>
  );
}

/**
 * The way in for whoever cannot scan.
 *
 * One field, upcased as it is typed and filtered to the code alphabet, so a
 * key that could never be part of a real code does nothing rather than
 * producing something that fails at the far end.
 *
 * `inputMode="text"` with autocapitalize on rather than a numeric keypad: the
 * codes are alphanumeric, and a phone that opens the wrong keyboard costs more
 * than the field saves.
 */
function CodeForm({
  value,
  error,
  scanned,
  onChange,
  onSubmit,
  onBackToScan,
}: {
  value: string;
  error: string | null;
  /** Reached here because a token failed, rather than by choice. */
  scanned: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBackToScan: () => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-full bg-secondary text-primary">
          {scanned ? <QrCode size={26} /> : <KeyRound size={26} />}
        </span>
        <p className="mt-3 font-display text-lg font-black uppercase tracking-wide text-foreground">
          Enter the code
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {scanned
            ? "That QR could not be used. Type the six characters read out instead."
            : "The six characters shown or read out at the event."}
        </p>
      </div>

      <label className="sr-only" htmlFor="attendance-code">
        Attendance code
      </label>
      <input
        id="attendance-code"
        value={value}
        onChange={(e) =>
          onChange(e.target.value.toUpperCase().replace(CODE_ALPHABET, "").slice(0, CODE_LENGTH))
        }
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={!scanned}
        placeholder="ABC123"
        aria-invalid={error !== null}
        className="mt-5 w-full rounded-lg border border-line bg-secondary/60 py-4 text-center font-mono text-3xl font-black uppercase tracking-[0.3em] text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-primary/60"
      />

      {error && (
        <p role="alert" className="mt-3 text-center text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={value.length !== CODE_LENGTH}
        // Full width and tall: this is pressed with a thumb, standing up.
        className="mt-5 w-full rounded-lg bg-primary py-4 font-head text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-accent disabled:opacity-40"
      >
        Check in
      </button>

      <button
        type="button"
        onClick={onBackToScan}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-line py-3 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <QrCode size={15} /> Scan a QR instead
      </button>
    </form>
  );
}
