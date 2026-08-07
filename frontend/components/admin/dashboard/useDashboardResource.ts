"use client";

/* Data fetching for the Dashboard specifically — deliberately not part of the
   shared `useAdminResource` in lib/adminApi.ts, so this module's caching
   behaviour can't change anything for Payments, Activity, Users, or any
   other screen built on that hook (same reasoning as, and closely mirrors,
   members/useMembersListResource.ts). */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/adminApi";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";

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

// The Map above is wiped by a hard reload, which would otherwise blank the
// dashboard back to a full skeleton even seconds after it was last showing
// real figures. sessionStorage survives the reload (but not a new tab),
// so it backs up the same entries and is consulted only when the in-memory
// map has nothing — same TTL, same stale-while-revalidate shape, just a
// second place to look.
const SESSION_PREFIX = "icpep.admin.dashboardCache:";

function readSessionCache<T>(path: string): { data: T; expiresAt: number } | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(SESSION_PREFIX + path);
    return raw ? (JSON.parse(raw) as { data: T; expiresAt: number }) : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionCache<T>(path: string, data: T, expiresAt: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_PREFIX + path, JSON.stringify({ data, expiresAt }));
  } catch {
    /* private browsing / storage full — the in-memory cache still works */
  }
}

function cacheGet<T>(path: string): T | undefined {
  const hit = cache.get(path);
  if (hit) {
    if (Date.now() <= hit.expiresAt) return hit.data as T;
    cache.delete(path);
  }

  const persisted = readSessionCache<T>(path);
  if (!persisted || Date.now() > persisted.expiresAt) return undefined;
  cache.set(path, persisted);
  return persisted.data;
}

function cacheSet<T>(path: string, data: T): void {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  cache.set(path, { data, expiresAt });
  writeSessionCache(path, data, expiresAt);
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
  }, [load]);

  // Recurring refetch (when asked), paused while the tab is in the
  // background — a dashboard nobody is looking at gains nothing from a 10s
  // poll, it just spends the officer's battery/data. See useVisibilityInterval.
  useVisibilityInterval(load, pollMs);

  return { data, error, loading, refresh: load };
}
