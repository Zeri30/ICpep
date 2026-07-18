import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminProvider from "@/components/admin/AdminProvider";
import AdminShell from "@/components/admin/layout/AdminShell";
import type { Me } from "@/lib/adminApi";

/* Server-side gate for every route under (admin). We forward the officer's
   session cookie to the backend's /api/admin/me and redirect to the landing
   page unless it comes back OK — so unauthenticated visitors never see the
   admin, with no client-side flash. Force IPv4 for the server-to-server call
   so it doesn't stall on an IPv6 localhost that the dev server isn't bound to. */
const BACKEND = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
  .replace("localhost", "127.0.0.1")
  // Trim any trailing slash so `${BACKEND}/api/...` can't produce a `//api/...`
  // path — the backend 404s the double slash, which would bounce every signed-in
  // officer back to the landing page.
  .replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookie = (await cookies()).toString();

  const res = await fetch(`${BACKEND}/api/admin/me`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  if (!res || !res.ok) redirect("/");

  const me: Me = await res.json();

  return (
    <AdminProvider officer={me.user} meta={me.meta}>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  );
}
