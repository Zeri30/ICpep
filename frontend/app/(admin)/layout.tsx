import { redirect } from "next/navigation";
import AdminProvider from "@/components/admin/AdminProvider";
import MembershipTermProvider from "@/components/admin/MembershipTermProvider";
import AdminShell from "@/components/admin/layout/AdminShell";
import { fetchMe } from "@/lib/serverMe";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await fetchMe();

  // Server-side gate for every route under (admin) — unauthenticated visitors
  // never see the admin, with no client-side flash.
  if (!me) redirect("/");

  // An account still on its system-generated first-login password gets sent
  // to the one screen it's allowed: nothing else in the shell should even be
  // reachable until that's resolved (EnsureAdmin enforces the same rule on
  // the backend, so this isn't the only thing standing in the way).
  if (me.user.mustChangePassword) redirect("/change-password");

  return (
    <AdminProvider officer={me.user} meta={me.meta}>
      <MembershipTermProvider>
        <AdminShell>{children}</AdminShell>
      </MembershipTermProvider>
    </AdminProvider>
  );
}
