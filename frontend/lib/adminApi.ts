"use client";

/* Client-side access to the JSON admin API.

   The admin is served same-origin (Next proxies /api/admin and /auth to the
   Laravel backend — see next.config.ts), so the officer session cookie and CSRF
   token flow exactly as the sign-in modal already relies on. Writes send the
   CSRF token in a header, mirroring SignInModal. A 401 means the session is
   gone, so we bounce to the landing page. */

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = "/api/admin";

/**
 * One role as the selects and badges consume it (see App\Enums\UserRole::options).
 *
 * `family` is the branch of the organization it belongs to — what the role badge
 * is coloured by and what the role selects group under; see lib/roleFamily.
 * `managesUsers` comes from the live privilege matrix rather than a hard-coded
 * list here, since that ability can be moved from the Privileges panel.
 */
export type RoleOption = {
  value: string;
  label: string;
  family: string;
  familyLabel: string;
  managesUsers: boolean;
};

/** The ability strings the backend Gates on (see App\Enums\Permission). */
export type Permission =
  | "members.view"
  | "members.edit"
  | "members.payment"
  | "finance.view"
  | "finance.revenue"
  | "users.manage"
  | "terms.manage"
  | "schedule.manage";

export type Officer = {
  name: string;
  username: string | null;
  email: string;
  role: string | null;
  roleLabel: string | null;
  /** True for roles allowed into User Management (Programming Team only). */
  canManageUsers: boolean;
  /** True while the account is still on its system-generated first-login
   *  password — the (admin) layout redirects to /change-password until it's
   *  cleared, and the backend refuses every other endpoint in the meantime. */
  mustChangePassword: boolean;
  /** The abilities this officer's role grants — the UI gates modules/actions on these. */
  permissions: Permission[];
};

export type AdminMeta = {
  fee: number;
  currency: string;
  classOptions: string[];
  sections: string[];
  yearLevels: string[];
  roles: RoleOption[];
  /**
   * The role families in the order their headings should appear — the grouping
   * for the role selects. Sent separately from the roles because the order of the
   * headings is its own decision; see App\Enums\RoleFamily::options().
   */
  roleFamilies: { value: string; label: string }[];
  /**
   * The role the account form starts a new account on — the least-privileged
   * one. Sent by the backend rather than taken as the last option, which only
   * happened to be that role until the Team Heads were added after it.
   */
  defaultRole: string;
  /** The Category options on the event form (see App\Models\Event::CATEGORIES). */
  eventCategories: string[];
  /**
   * The organization's timezone. Every date on the calendar is a day in this
   * zone, not in the viewer's — the API converts, so the UI only has to say so.
   */
  timezone: string;
};

export type Me = { user: Officer; meta: AdminMeta };

/** Thrown for a non-2xx response; carries the status and parsed message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;

async function getCsrf(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  const res = await fetch("/auth/csrf", { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, "Could not establish a session.");
  const { token } = await res.json();
  csrfToken = token;
  return token;
}

async function parse(res: Response): Promise<unknown> {
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data;

  // Session expired or signed out elsewhere — return to the public site.
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/";
  }
  const message =
    (data as { message?: string }).message ?? "Something went wrong. Please try again.";
  throw new ApiError(res.status, message);
}

/** GET a JSON endpoint under /api/admin. */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return parse(res) as Promise<T>;
}

/** POST/PATCH/DELETE with CSRF. Retries once if the token went stale (419). */
export async function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  isAuthPath = false,
): Promise<T> {
  const url = isAuthPath ? path : `${API_BASE}${path}`;
  const send = async (token: string) =>
    fetch(url, {
      method,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-CSRF-TOKEN": token,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send(await getCsrf());
  if (res.status === 419) res = await send(await getCsrf(true));
  return parse(res) as Promise<T>;
}

/** Sign out: clears the session and returns the landing-page URL. */
export async function signOut(): Promise<void> {
  const { redirect } = await apiSend<{ redirect: string }>(
    "POST",
    "/auth/admin/logout",
    undefined,
    true,
  );
  window.location.href = redirect ?? "/";
}

/** "Manage sessions" — sign this account out of every other device, keeping
    the one calling this signed in. */
export async function logoutOtherSessions(): Promise<void> {
  await apiSend<{ ok: true }>("POST", "/me/sessions/logout-others");
}

/** "Manage sessions" — sign this account out everywhere, including the
    device calling this, then return the landing-page URL. */
export async function logoutAllSessions(): Promise<void> {
  const { redirect } = await apiSend<{ redirect: string }>("POST", "/me/sessions/logout-all");
  window.location.href = redirect ?? "/";
}

/** Fired after a module is marked viewed, so AdminSidebar's badge (a separate
    component, polling on its own timer) can zero out immediately instead of
    waiting for its next poll. */
export const MODULE_VIEWED_EVENT = "icpep:module-viewed";

/** "I just opened this module" — zeroes the signed-in officer's sidebar badge
    for it (see ModuleView on the backend). Errors are swallowed: failing to
    record a view is not worth surfacing to whoever just opened a list. */
export async function markModuleViewed(module: "members" | "payments" | "users" | "activity"): Promise<void> {
  try {
    await apiSend<{ ok: true }>("POST", `/me/views/${module}`);
    window.dispatchEvent(new Event(MODULE_VIEWED_EVENT));
  } catch {
    // Best-effort — see above.
  }
}

/** Real-interaction heartbeat for the 6-hour inactivity timeout (see
    components/admin/IdleLogout.tsx and the backend's EnforceIdleTimeout).
    Errors are swallowed — a missed heartbeat just means the next one, or the
    server's own check on any other request, settles it. */
export async function pingActivity(): Promise<void> {
  try {
    await apiSend<{ ok: true }>("POST", "/me/activity-ping");
  } catch {
    // Best-effort — see above.
  }
}

/** Fetch a resource once, optionally re-fetching on an interval (like Filament's
    widget polling). Pass `path = null` to stay idle. */
export function useAdminResource<T>(
  path: string | null,
  opts: { pollMs?: number } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Unlike `loading` (which starts true and never goes true again — it
  // describes only the very first fetch), this is true for every in-flight
  // request against the current `path`, including a page/filter/sort change
  // well after the initial load. Callers with a pager use it to disable the
  // page controls while a click's request is still outstanding, so a second
  // click can't queue an overlapping request — see Pagination's `disabled`.
  const [fetching, setFetching] = useState(false);
  const { pollMs } = opts;

  /**
   * Which request is the current one. Responses are not guaranteed to come back
   * in the order they were sent, and the slow one is not always the old one —
   * switching membership list has been seen to land the *previous* semester's
   * response seconds after the new semester's request went out, leaving one
   * semester's members sitting under another's heading with nothing to say they
   * were stale. A response that is no longer the one being waited on is dropped
   * rather than written, so `data` only ever moves forwards.
   */
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const mine = ++requestId.current;
    setFetching(true);
    try {
      const next = await apiGet<T>(path);
      if (mine !== requestId.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (mine !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      // Guarded too: a superseded request must not report that the current one
      // has finished loading.
      if (mine === requestId.current) {
        setLoading(false);
        setFetching(false);
      }
    }
  }, [path]);

  useEffect(() => {
    // Fetch on mount and, when asked, poll — syncing UI with the API (the kind
    // of external-system subscription effects are for).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    if (!pollMs) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, error, loading, fetching, refresh: load };
}
