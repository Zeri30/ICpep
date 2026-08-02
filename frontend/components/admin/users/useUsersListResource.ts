"use client";

/* Data fetching for the User Management table specifically — deliberately not
   part of the shared `useAdminResource` in lib/adminApi.ts, so this module's
   caching and request-deduplication behaviour can't change anything for
   Payments, Activity, the Dashboard, Calendar, or any other screen built on
   that hook. Closely mirrors members/useMembersListResource.ts. */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";

/**
 * A short-lived, in-memory cache of `/users` responses, keyed by the full
 * query string (search + role + status + sort + page). Private to this
 * module, so paging back to a page already seen — or re-selecting a filter —
 * paints instantly instead of shimmering again for data already on hand.
 *
 * Kept short (seconds, not minutes) — accounts can change from other admin
 * sessions too, so the goal is smoothing out one officer's own back-and-forth
 * through the table, not standing in for a real refetch.
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

/** Fetches one page of User Management's account list. */
export function useUsersListResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // True whenever a network request for the *current* query is outstanding —
  // including a background revalidation after an instant cache hit. This is
  // what the pager checks before allowing another page click, so a second
  // request can't be fired while the first is still in flight — see
  // Pagination's `disabled`.
  const [fetching, setFetching] = useState(false);

  /**
   * Which request is the current one. A response that is no longer the one
   * being waited on is dropped rather than written, so `data` only ever
   * moves forwards — same guard as useMembersListResource.
   */
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
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

  // A mutation (create, edit, delete, activate/deactivate, reset password)
  // can move figures on pages other than the one currently on screen, so a
  // refresh clears every cached page/filter/sort combination before
  // re-fetching this one.
  const refresh = useCallback(() => {
    cache.clear();
    return load(true);
  }, [load]);

  return { data, error, loading, fetching, refresh };
}
