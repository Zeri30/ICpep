"use client";

/* Shown once a 401 reveals this officer's session is already gone — idle
   timeout, User Management's "log out all admins", a deactivation, or any
   other cause the backend didn't need to say more about. Explains why
   instead of the officer just landing back on the public site mid-click
   with no idea what happened, then redirects there itself after a short
   delay (or immediately if they click through). */

import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SESSION_ENDED_EVENT, type SessionEndedDetail } from "@/lib/adminApi";

const REDIRECT_DELAY_MS = 5000;

export default function SessionEndedModal() {
  const [message, setMessage] = useState<string | null>(null);
  // Portal target only exists on the client; mount after hydration.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onEnded = (e: Event) => {
      setMessage((e as CustomEvent<SessionEndedDetail>).detail.message);
    };
    window.addEventListener(SESSION_ENDED_EVENT, onEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded);
  }, []);

  useEffect(() => {
    if (message === null) return;
    const id = setTimeout(() => {
      window.location.href = "/";
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(id);
  }, [message]);

  if (!mounted || message === null) return null;

  return createPortal(
    <>
      {/* Above ConfirmDialog's own z-[110]/[120] — a session ending mid-confirm
          should take over, not sit hidden behind whatever was already open. */}
      <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[210] grid place-items-center p-4">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="session-ended-title"
          className="w-full max-w-sm rounded-xl border border-line bg-card p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary text-primary">
            <AlertCircle size={22} />
          </div>
          <h2
            id="session-ended-title"
            className="font-display text-xl font-black uppercase tracking-wide text-foreground"
          >
            Signed out
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent sm:w-auto"
          >
            Go to sign in
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
