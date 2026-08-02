"use client";

/* Signs an officer out after 6 hours with no genuine activity — not simply 6
   hours since the tab was opened, and not fooled by the background polling
   AdminSidebar/Dashboard/AttendanceRoster already do on their own timers (see
   pingActivity's docblock in lib/adminApi.ts). Only real interaction events,
   while the tab is actually visible, count; a tab left open in the
   background or switched away from accrues idle time exactly like one nobody
   is touching.

   The activity timestamp lives in localStorage, shared by every tab on this
   origin, so any tab's real activity resets every tab's clock and the count
   survives a refresh. The backend enforces the same 6-hour window on its own
   (EnforceIdleTimeout) from the heartbeat this sends — that server-side check
   is the actual source of truth; this component's own signOut() call is just
   what makes a genuinely idle tab redirect promptly instead of waiting for
   the next request to bounce off a 401. */

import { useEffect, useRef } from "react";
import { pingActivity, signOut } from "@/lib/adminApi";

const IDLE_TIMEOUT_MS = 6 * 60 * 60 * 1000;
const STORAGE_KEY = "icpep:admin-last-activity";
const PING_MIN_INTERVAL_MS = 2 * 60 * 1000;
const LOCAL_WRITE_MIN_INTERVAL_MS = 5 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "wheel", "scroll"] as const;

function readLastActivity(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    // Private mode / storage disabled — the server-side check still enforces the timeout.
  }
}

export default function IdleLogout() {
  const loggingOutRef = useRef(false);
  const lastLocalWriteRef = useRef(0);
  const lastPingRef = useRef(0);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === null) {
      writeLastActivity(Date.now());
    }

    const recordActivity = () => {
      if (document.visibilityState !== "visible" || loggingOutRef.current) return;
      const now = Date.now();

      if (now - lastLocalWriteRef.current >= LOCAL_WRITE_MIN_INTERVAL_MS) {
        lastLocalWriteRef.current = now;
        writeLastActivity(now);
      }

      if (now - lastPingRef.current >= PING_MIN_INTERVAL_MS) {
        lastPingRef.current = now;
        pingActivity();
      }
    };

    const checkIdle = () => {
      if (loggingOutRef.current) return;
      if (Date.now() - readLastActivity() >= IDLE_TIMEOUT_MS) {
        loggingOutRef.current = true;
        signOut();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity();
        checkIdle();
      }
    };

    for (const type of ACTIVITY_EVENTS) {
      window.addEventListener(type, recordActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    checkIdle();

    return () => {
      for (const type of ACTIVITY_EVENTS) {
        window.removeEventListener(type, recordActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  return null;
}
