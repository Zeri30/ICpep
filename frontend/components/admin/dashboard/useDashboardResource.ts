"use client";

/* Data fetching for the Dashboard specifically — deliberately not part of the
   shared `useAdminResource` in lib/adminApi.ts, so this module's caching
   behaviour can't change anything for Payments, Activity, Users, or any
   other screen built on that hook (same reasoning as, and closely mirrors,
   members/useMembersListResource.ts). */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";

/**
 * A short-lived, in-memory cache of `/dashboard` responses, keyed by the full
 * query string (term). Private to this module, so clicking back into the
 * Dashboard shortly after leaving it paints the figures already on hand
 * instantly instead of blanking to a full skeleton and waiting on the
 * network again for numbers that almost certainly haven't changed.
 *
 * Kept short (seconds, not minutes) and never trusted on its own — every
 * call still fetches fresh data behind it (see `load` below), so the 10s
 * poll this hook also drives keeps revalidating exactly as before; this only
 * removes the empty flash on the *first* paint after a remount.
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
    starting a second identical request — e.g. a poll tick landing right as a
    remount's own fetch is still outstanding. */
function dedupedGet<T>(path: string): Promise<T> {
  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = apiGet<T>(path).finally(() => inFlight.delete(path));
  inFlight.set(path, request);
  return request;
}

/**
 * Fetches the Dashboard's data, optionally polling. Pass `path = null` to
 * stay idle (used while the membership term is still being resolved).
 */
export function useDashboardResource<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { pollMs } = opts;

  // Which request is the current one — responses can land out of order
  // (switching membership list has been seen to land the *previous*
  // semester's response after the new one), so a superseded response is
  // dropped rather than written. Same guard as useMembersListResource.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const mine = ++requestId.current;

    // An instant repaint from a recent cache entry, while the fetch below
    // still confirms nothing has changed since — same stale-while-revalidate
    // shape as useMembersListResource, so a poll tick always hits the
    // network regardless of what this finds.
    const cached = cacheGet<T>(path);
    if (cached !== undefined) {
      setData(cached);
      setError(null);
      setLoading(false);
    }

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
      if (mine === requestId.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (!pollMs) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, error, loading, refresh: load };
}
