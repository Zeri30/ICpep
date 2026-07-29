import { cookies } from "next/headers";
import type { Me } from "@/lib/adminApi";

/* Server-side access to the signed-in officer, shared by the (admin) layout's
   auth gate and the standalone /change-password page — both need the same
   "forward the session cookie to the backend's /me" call before deciding
   where to redirect. */

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
  .replace("localhost", "127.0.0.1")
  // Trim any trailing slash so `${BACKEND}/api/...` can't produce a `//api/...`
  // path — the backend 404s the double slash, which would bounce every
  // signed-in officer back to the landing page.
  .replace(/\/+$/, "");

/** The signed-in officer plus their config bundle, or null if there isn't one. */
export async function fetchMe(): Promise<Me | null> {
  const cookie = (await cookies()).toString();

  const res = await fetch(`${BACKEND}/api/admin/me`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) return null;
  return res.json();
}
