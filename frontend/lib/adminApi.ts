"use client";

/* Client-side access to the JSON admin API.

   The admin is served same-origin (Next proxies /api/admin and /auth to the
   Laravel backend — see next.config.ts), so the officer session cookie and CSRF
   token flow exactly as the sign-in modal already relies on. Writes send the
   CSRF token in a header, mirroring SignInModal. A 401 means the session is
   gone, so we bounce to the landing page. */

import { useCallback, useEffect, useState } from "react";

const API_BASE = "/api/admin";

export type RoleOption = { value: string; label: string };

/** The ability strings the backend Gates on (see App\Enums\Permission). */
export type Permission =
  | "members.view"
  | "members.edit"
  | "members.payment"
  | "finance.view"
  | "users.manage"
  | "terms.manage";

export type Officer = {
  name: string;
  username: string | null;
  email: string;
  role: string | null;
  roleLabel: string | null;
  /** True for roles allowed into User Management (Programming Team only). */
  canManageUsers: boolean;
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

/** Fetch a resource once, optionally re-fetching on an interval (like Filament's
    widget polling). Pass `path = null` to stay idle. */
export function useAdminResource<T>(
  path: string | null,
  opts: { pollMs?: number } = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { pollMs } = opts;

  const load = useCallback(async () => {
    if (path === null) return;
    try {
      setData(await apiGet<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
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

  return { data, error, loading, refresh: load };
}
