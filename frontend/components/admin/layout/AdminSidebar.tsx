"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CalendarDays, Clock, LayoutDashboard, ShieldCheck, Users, Wallet } from "lucide-react";
import Logo from "@/components/ui/Logo";
import { useAdmin } from "@/components/admin/AdminProvider";
import SignOutButton from "@/components/admin/layout/SignOutModal";
import { MODULE_VIEWED_EVENT, useAdminResource } from "@/lib/adminApi";
import { formatBadgeCount } from "@/lib/adminFormat";
import { useTerms } from "@/components/admin/MembershipTermProvider";

import type { Permission } from "@/lib/adminApi";

type Counts = { members: number; payments: number; users: number; activity: number };

// `need` is the permission required to see the item (null = any active admin).
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, badgeKey: null, need: null },
  { href: "/admin/members", label: "Members List", icon: Users, badgeKey: "members", need: "members.view" },
  // Open to every role: reading the schedule needs no ability, only changing
  // it does. So there is no `need` here — the module itself is not gated.
  { href: "/admin/schedules", label: "Schedules", icon: CalendarDays, badgeKey: null, need: null },
  { href: "/admin/payments", label: "Payment History", icon: Wallet, badgeKey: "payments", need: "finance.view" },
  { href: "/admin/users", label: "User Management", icon: ShieldCheck, badgeKey: "users", need: "users.manage" },
  // Open to every role too — same reasoning as Schedules above.
  { href: "/admin/activity", label: "Activity Log", icon: Clock, badgeKey: "activity", need: null },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badgeKey: "members" | "payments" | "users" | "activity" | null;
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
  const { selected: term } = useTerms();
  // Unread nav counts — records created since this officer last opened each
  // module (DashboardController::counts), not the module's total row count.
  const { data: counts, refresh: refreshCounts } = useAdminResource<Counts>(
    `/counts${term ? `?term=${term.id}` : ""}`,
    { pollMs: 30000 },
  );

  // A module page marks itself viewed on mount (see markModuleViewed) and
  // fires this event, so its badge zeroes out immediately instead of sitting
  // stale until the next 30s poll.
  useEffect(() => {
    window.addEventListener(MODULE_VIEWED_EVENT, refreshCounts);
    return () => window.removeEventListener(MODULE_VIEWED_EVENT, refreshCounts);
  }, [refreshCounts]);

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
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-line/60 px-5 h-[72px] hover:bg-secondary/30 transition-colors"
      >
        <Logo size={34} />
        <div className="leading-tight">
          <p className="font-display text-sm font-black tracking-wide text-foreground">ICpEP.SE</p>
          <p className="font-head text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
        </div>
      </Link>

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
              {typeof badge === "number" && badge > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                  {formatBadgeCount(badge)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Only below `sm` — the topbar has room for the sign-out button itself
          from `sm` up (see AdminTopbar), and a second copy here would just be
          a duplicate sitting a few pixels away from the first. */}
      <div className="border-t border-line/60 p-3 sm:hidden">
        <SignOutButton variant="row" />
      </div>
    </aside>
  );
}
