"use client";

import {
  Banknote,
  Calendar,
  CalendarDays,
  GraduationCap,
  Loader2,
  Users,
} from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import StatCard from "@/components/admin/dashboard/StatCard";
import BarChart from "@/components/admin/ui/BarChart";
import LineChart from "@/components/admin/ui/LineChart";
import { useAdminResource } from "@/lib/adminApi";
import type { DashboardData } from "@/lib/adminTypes";

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">{title}</h2>
      {description && <p className="mb-4 mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className={description ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { money } = useAdmin();
  // Poll at the tightest Filament interval (stats were 10s).
  const { data, loading, error } = useAdminResource<DashboardData>("/dashboard", { pollMs: 10000 });

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading dashboard…
      </div>
    );
  }
  if (error && !data) return <p className="py-20 text-sm text-red-400">{error}</p>;
  if (!data) return null;

  const { stats, paymentSummary: ps, membersByClass, registrationsOverTime } = data;
  const revenueDesc =
    `${stats.paid} of ${stats.members} paid` +
    (stats.unpaid > 0 ? ` · ${stats.unpaid} pending ${money(stats.pendingRevenue)}` : "");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Dashboard</h1>

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={stats.members} description="registered members" icon={Users} tone="primary" />
        <StatCard label="3rd Year" value={stats.thirdYear} description="members" icon={GraduationCap} tone="info" />
        <StatCard label="4th Year" value={stats.fourthYear} description="members" icon={GraduationCap} tone="info" />
        <StatCard
          label="Revenue collected"
          value={money(stats.revenue)}
          description={revenueDesc}
          icon={Banknote}
          tone={stats.unpaid > 0 ? "warning" : "success"}
        />
      </div>

      {/* Payment summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Collected today" value={money(ps.today.amount)} description={`${ps.today.members} members · ${ps.today.label}`} icon={Banknote} tone={ps.today.members > 0 ? "success" : "info"} />
        <StatCard label="This week" value={money(ps.week.amount)} description={`${ps.week.members} members · ${ps.week.label}`} icon={CalendarDays} tone={ps.week.members > 0 ? "success" : "info"} />
        <StatCard label="This month" value={money(ps.month.amount)} description={`${ps.month.members} members · ${ps.month.label}`} icon={Calendar} tone={ps.month.members > 0 ? "success" : "info"} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Members by year & section" description="Live headcount per class (3A / 3B / 4A / 4B).">
          <BarChart labels={membersByClass.labels} data={membersByClass.data} />
        </Panel>
        <Panel title="Registrations over time" description="New members per month (last 6 months).">
          <LineChart labels={registrationsOverTime.labels} data={registrationsOverTime.data} />
        </Panel>
      </div>
    </div>
  );
}
