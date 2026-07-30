"use client";

/* Data fetching for the Members List table specifically — deliberately not part
   of the shared `useAdminResource` in lib/adminApi.ts, so this module's caching
   and request-deduplication behaviour can't change anything for Payments,
   Activity, Users, the Dashboard, or any other screen built on that hook. */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";

/**
 * A short-lived, in-memory cache of `/members` responses, keyed by the full
 * query string (term + filters + sort + page). Private to this module, so
 * paging back to a page already seen — or re-selecting a filter — paints
 * instantly instead of shimmering again for data already on hand.
 *
 * `inFlight` is request deduplication: two renders asking for the same query
 * at once (e.g. React Strict Mode's double-invoke in development) share one
 * network call instead of firing two.
 *
 * Kept short (seconds, not minutes) — this is a live roster other officers can
 * edit, so the goal is smoothing out one officer's own back-and-forth through
 * the table, not standing in for a real refetch.
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

/**
 * Fetches one page of the Members List. Pass `path = null` to stay idle (used
 * while the membership term is still being resolved).
 */
export function useMembersListResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // True whenever a network request for the *current* query is outstanding —
  // including a background revalidation after an instant cache hit. This is
  // what the pager checks before allowing another page click, so a second
  // request can't be fired while the first is still in flight.
  const [fetching, setFetching] = useState(false);

  /**
   * Which request is the current one. Responses are not guaranteed to come
   * back in the order they were sent — switching membership list has been
   * seen to land the *previous* semester's response seconds after the new
   * semester's request went out. A response that is no longer the one being
   * waited on is dropped rather than written, so `data` only ever moves
   * forwards.
   */
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
    if (path === null) return;
    const mine = ++requestId.current;

    // A cache hit paints immediately and skips the loading state entirely —
    // but still revalidates below, since another officer may have changed
    // this data since it was cached.
    if (!force) {
      const cached = cacheGet<T>(path);
      if (cached !== undefined) {
        setData(cached);
        setError(null);
        setLoading(false);
      }
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

  // A mutation (edit, delete, restore, toggle-paid, bulk action) can move
  // figures on pages other than the one currently on screen, so a refresh
  // clears every cached page/filter/sort combination before re-fetching this
  // one — cheaper and safer than working out which ones it actually touched.
  const refresh = useCallback(() => {
    cache.clear();
    return load(true);
  }, [load]);

  return { data, error, loading, fetching, refresh };
}
