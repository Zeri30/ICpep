"use client";

/* Recording that you are here.

   Two ways in, and the page is the same screen for both: arriving with a token
   in the URL (the QR was scanned) checks in on its own, and arriving without
   one shows the six-character code field instead. The camera failing is the
   normal reason for the second, so it is offered on the first screen rather
   than hidden behind a link.

   Built for a phone held one-handed in a room where the meeting has already
   started. One thing on screen at a time, type large enough to read at arm's
   length, and an answer that can be taken in without reading a sentence — the
   colour and the icon say it before the words do. */

import { AlertTriangle, CalendarDays, Check, Clock, KeyRound, Loader2, QrCode } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/ui/Logo";
import { ApiError, apiGet, apiSend } from "@/lib/adminApi";
import type { CheckInState } from "@/lib/adminTypes";

/** How long the code is — the field is sized and validated against this. */
const CODE_LENGTH = 6;

/**
 * The alphabet the backend draws codes from — no 0 *or* O, no 1, I or L,
 * because the code is read aloud across a room and typed on a phone.
 *
 * Both halves of each confusable pair are missing, so there is nothing to
 * helpfully substitute: a character outside this set can never be part of a
 * real code, whichever one was meant. The field simply refuses to take them,
 * which is the honest version of the same help — the wrong key does nothing
 * instead of producing a code that fails at the far end.
 *
 * ⚠ Mirrors Event::CODE_ALPHABET. A character added there and not here would
 * become untypable.
 */
const CODE_ALPHABET = /[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g;

/** Everything the page can be showing. */
type Phase =
  /** Resolving the token in the URL. */
  | "resolving"
  /** Recording the check-in. */
  | "submitting"
  /** Waiting for a code to be typed — no token, or the token was no good. */
  | "code"
  /** Done: they are on the record. */
  | "done"
  /** The event is over, cancelled, or its day has passed. */
  | "closed";

export default function CheckIn({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>(token ? "resolving" : "code");
  const [state, setState] = useState<CheckInState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Scanning is one gesture and should stay one: nothing to press once the
  // camera has done its work. Guarded so React's development double-invoke —
  // and any later re-render — cannot fire a second request; the endpoint is
  // idempotent either way, but a duplicate POST is still a duplicate POST.
  const attempted = useRef(false);

  const checkIn = useCallback(async (body: { token: string } | { code: string }) => {
    setPhase("submitting");
    setError(null);

    try {
      const result = await apiSend<CheckInState>("POST", "/check-in", body);
      setState(result);
      setPhase(result.accepted ? "done" : "closed");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not record your attendance.";

      // A token that the event no longer honours is not something typing a code
      // can fix — the code is dead for the same reason. Anything else leaves
      // the officer on the code field, which is the way out of a QR that will
      // not scan.
      if (e instanceof ApiError && e.status === 404) {
        setError("This check-in link is not valid. Enter the code instead.");
      } else {
        setError(message);
      }
      setPhase("code");
    }
  }, []);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    // Asked before recording, so an expired QR is answered with "this event has
    // already passed" rather than with a validation error about a token.
    (async () => {
      try {
        const resolved = await apiGet<CheckInState>(
          `/check-in?token=${encodeURIComponent(token)}`,
        );
        setState(resolved);

        if (!resolved.accepted) return setPhase("closed");
        // Already on the record — from an earlier scan, or because the
        // Secretary ticked them off. Nothing to send.
        if (resolved.status === "present") {
          setState({ ...resolved, alreadyCheckedIn: true });
          return setPhase("done");
        }

        await checkIn({ token });
      } catch {
        setError("This check-in link is not valid. Enter the code instead.");
        setPhase("code");
      }
    })();
  }, [token, checkIn]);

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) {
      return setError(`The code is ${CODE_LENGTH} characters.`);
    }
    checkIn({ code });
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} className="h-11 w-11" />
          <h1 className="mt-4 font-display text-2xl font-black uppercase tracking-wide text-foreground">
            Attendance
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">ICpEP.SE officers</p>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          {phase === "resolving" || phase === "submitting" ? (
            <Working label={phase === "resolving" ? "Reading the code…" : "Checking you in…"} />
          ) : phase === "done" && state ? (
            <Recorded state={state} />
          ) : phase === "closed" && state ? (
            <Closed state={state} />
          ) : (
            <CodeForm
              value={code}
              error={error}
              scanned={token !== null}
              onChange={setCode}
              onSubmit={submitCode}
            />
          )}
        </div>

        {/* Shown under the card in the two states that are not the form, where
            it would otherwise have nowhere to go. */}
        {error && phase !== "code" && (
          <p className="mt-3 text-center text-xs text-red-400">{error}</p>
        )}
      </div>
    </main>
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
          : "The Secretary can see you on the roster. You can close this page."}
      </p>
    </div>
  );
}

/** The event stopped taking attendance before this scan arrived. */
function Closed({ state }: { state: CheckInState }) {
  return (
    <div className="text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-accent/15 text-amber-accent">
        <AlertTriangle size={30} />
      </span>

      <p className="mt-4 font-display text-xl font-black uppercase tracking-wide text-foreground">
        Not taking attendance
      </p>

      {/* The backend's own words, so the page that refuses a scan and the panel
          the Secretary is looking at never tell different stories. */}
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
}: {
  value: string;
  error: string | null;
  /** Whether they got here by scanning — changes what the heading is about. */
  scanned: boolean;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
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
    </form>
  );
}
