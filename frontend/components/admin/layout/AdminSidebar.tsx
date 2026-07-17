"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, LayoutDashboard, ShieldCheck, Users, Wallet } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useAdminResource } from "@/lib/adminApi";

import type { Permission } from "@/lib/adminApi";

type Counts = { members: number; payments: number; users: number };

// `need` is the permission required to see the item (null = any active admin).
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badgeKey: null, need: null },
  { href: "/admin/members", label: "Members List", icon: Users, badgeKey: "members", need: "members.view" },
  { href: "/admin/payments", label: "Payment History", icon: Wallet, badgeKey: "payments", need: "finance.view" },
  { href: "/admin/users", label: "User Management", icon: ShieldCheck, badgeKey: "users", need: "users.manage" },
  { href: "/admin/activity", label: "Activity Log", icon: Clock, badgeKey: null, need: null },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey: "members" | "payments" | "users" | null;
  need: Permission | null;
}>;

export default function AdminSidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { can } = useAdmin();
  // Live nav counts, refreshed like Filament's badges.
  const { data: counts } = useAdminResource<Counts>("/counts", { pollMs: 30000 });

  // Only show modules the officer's role can reach; the backend enforces the
  // same rule regardless, so hidden modules are also inaccessible by URL.
  const nav = NAV.filter((item) => item.need === null || can(item.need));

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-[#070707] transition-transform duration-300 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-line/60 px-5 h-[72px]">
        <Logo size={34} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-wide text-foreground">ICpEP.SE</p>
          <p className="font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map(({ href, label, icon: Icon, badgeKey }) => {
          const active = isActive(href);
          const badge = badgeKey ? counts?.[badgeKey] : null;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary/10 text-primary"
                  : "text-secondary-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
              <Icon size={18} />
              <span className="flex-1 uppercase tracking-wide font-head text-xs">{label}</span>
              {typeof badge === "number" && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
