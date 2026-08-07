"use client";

/* Runs a callback on a repeating interval, paused while the tab is hidden and
   caught back up with an immediate call — not just a timer restart — the
   moment it becomes visible again, since whatever it polls may already be
   stale by however long the tab was hidden. A tab nobody is looking at
   gains nothing from a poll firing in the background, it only spends the
   visitor's battery/data and the server's.

   Extracted from useDashboardResource's original inline implementation, the
   first place this shape was written; every other interval-based poller in
   the admin (useAdminResource, SessionWatchdog, Members List's and Payment
   History's change-pollers) now shares this one copy instead of repeating it.

   Deliberately NOT used by IdleLogout: that component's interval has to keep
   checking even while the tab is hidden — the whole point of it is catching
   a *backgrounded* idle tab, which pausing here would defeat. */

import { useEffect, useRef } from "react";

/**
 * @param callback Called on every tick, and once immediately whenever the
 *   tab transitions from hidden back to visible. Read through a ref so the
 *   interval itself doesn't need to restart when the callback identity
 *   changes between renders.
 * @param intervalMs Tick interval; pass `null`/`undefined`/`0` to disable
 *   polling entirely (the effect becomes a no-op, matching `useAdminResource`
 *   and `useDashboardResource`'s existing "no pollMs" behavior).
 */
export function useVisibilityInterval(callback: () => void, intervalMs?: number | null): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!intervalMs) return;

    let id: ReturnType<typeof setInterval> | null = null;
    const tick = () => callbackRef.current();
    const start = () => {
      if (id === null) id = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
        tick();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
