"use client";

/* Data fetching for the calendar's `/events` list — shared by the Calendar
   module (EventCalendar.tsx) and the Dashboard's UpcomingEvents widget,
   since both fetch the exact same unfiltered resource. Deliberately not part
   of the generic `useAdminResource` in lib/adminApi.ts, so this caching
   behaviour can't change anything for Payments, Activity, Users, or the
   Dashboard's own stats (see useDashboardResource / useMembersListResource,
   which this mirrors). A *shared* cache rather than one per component
   matters here specifically: without it, saving or deleting an event in the
   Calendar would refresh the Calendar's own view but leave the Dashboard
   widget serving a stale list for the rest of the cache window. */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";

const PATH = "/events";

/**
 * A short-lived, in-memory cache of the last `/events` response. Paints
 * instantly from whatever was last seen instead of a full skeleton every
 * time an officer moves between the Calendar and the Dashboard — both show
 * the same list, so there is no reason the second one to mount should look
 * like it is loading from nothing.
 *
 * Kept short (seconds, not minutes) and never trusted on its own — every
 * call still fetches fresh data behind it (see `load` below), same
 * stale-while-revalidate shape as useMembersListResource/useDashboardResource.
 */
const CACHE_TTL_MS = 15_000;
let cache: { data: unknown; expiresAt: number } | null = null;
let inFlight: Promise<unknown> | null = null;

function cacheGet<T>(): T | undefined {
  if (!cache) return undefined;
  if (Date.now() > cache.expiresAt) {
    cache = null;
    return undefined;
  }
  return cache.data as T;
}

function cacheSet<T>(data: T): void {
  cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
}

function cacheClear(): void {
  cache = null;
}

/** The in-flight GET, reused instead of starting a second identical request
    — e.g. the Calendar and the Dashboard widget both mounting at once. */
function dedupedGet<T>(): Promise<T> {
  if (inFlight) return inFlight as Promise<T>;

  const request = apiGet<T>(PATH).finally(() => {
    inFlight = null;
  });
  inFlight = request;
  return request;
}

/** Fetches the shared `/events` list. */
export function useEventsResource<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Which request is the current one — see useMembersListResource for why
  // this guard exists (responses can land out of order).
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
    const mine = ++requestId.current;

    if (!force) {
      const cached = cacheGet<T>();
      if (cached !== undefined) {
        setData(cached);
        setError(null);
        setLoading(false);
      }
    }

    try {
      const next = await dedupedGet<T>();
      if (mine !== requestId.current) return;
      cacheSet(next);
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // A save or delete can change what every other viewer of this list should
  // see, so the shared cache is dropped before re-fetching rather than just
  // updating this component's own copy of it.
  const refresh = useCallback(() => {
    cacheClear();
    return load(true);
  }, [load]);

  return { data, error, loading, refresh };
}
