"use client";

/* Data fetching for the Activity Log table specifically — deliberately not
   part of the shared `useAdminResource` in lib/adminApi.ts, so this module's
   caching and request-deduplication behaviour can't change anything for
   Payments, Users, the Dashboard, Calendar, or any other screen built on
   that hook. Closely mirrors members/useMembersListResource.ts.

   No `refresh()` export: the log is read-only from this screen (nothing here
   writes an activity_logs row), so there is no mutation that needs to
   invalidate the cache early — the short TTL below is the only staleness
   this table ever has. */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";

/**
 * A short-lived, in-memory cache of `/activity` responses, keyed by the full
 * query string (search + action + date range + page). Private to this
 * module, so paging back to a page already seen — or re-selecting a filter —
 * paints instantly instead of shimmering again for data already on hand.
 */
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlight = new Map<string, Promise<unknown>>();

function cacheGet<T>(path: string): T | undefined {
  const hit = cache.get(path);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(path);
    return undefined;
  }
  return hit.data as T;
}

function cacheSet<T>(path: string, data: T): void {
  cache.set(path, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** The in-flight GET for `path`, reusing one already underway instead of
    starting a second identical request. */
function dedupedGet<T>(path: string): Promise<T> {
  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = apiGet<T>(path).finally(() => inFlight.delete(path));
  inFlight.set(path, request);
  return request;
}

/** Fetches one page of the Activity Log. */
export function useActivityLogResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // True whenever a network request for the *current* query is outstanding —
  // what the pager checks before allowing another page click, so a second
  // request can't be fired while the first is still in flight — see
  // Pagination's `disabled`.
  const [fetching, setFetching] = useState(false);

  // Which request is the current one. A response that is no longer the one
  // being waited on is dropped rather than written, so `data` only ever
  // moves forwards — same guard as useMembersListResource.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const mine = ++requestId.current;

    // A cache hit paints immediately and skips the loading state entirely —
    // but still revalidates below, since the log keeps growing underneath.
    const cached = cacheGet<T>(path);
    if (cached !== undefined) {
      setData(cached);
      setError(null);
      setLoading(false);
    }

    setFetching(true);
    try {
      const next = await dedupedGet<T>(path);
      if (mine !== requestId.current) return;
      cacheSet(path, next);
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      // Guarded too: a superseded request must not report that the current
      // one has finished loading.
      if (mine === requestId.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return { data, error, loading, fetching };
}
