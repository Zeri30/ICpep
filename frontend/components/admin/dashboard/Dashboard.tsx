"use client";

import {
  Banknote,
  Calendar,
  CalendarDays,
  GraduationCap,
  Users,
} from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import StatCard from "@/components/admin/dashboard/StatCard";
import UpcomingEvents from "@/components/admin/dashboard/UpcomingEvents";
import BarChart from "@/components/admin/ui/BarChart";
import LineChart from "@/components/admin/ui/LineChart";
import { Bar } from "@/components/admin/ui/Skeleton";
import { useAdminResource } from "@/lib/adminApi";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import type { DashboardData } from "@/lib/adminTypes";

/** One StatCard, in placeholder form — label, icon, value and description
    bars sized to what StatCard actually renders, so the tile is exactly as
    tall before the figures arrive as after. */
function StatCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <Bar w="w-20" h="h-3" />
        <span className="skeleton block size-9 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3">
        <Bar w="w-16" h="h-8" />
      </div>
      <div className="mt-1.5">
        <Bar w="w-32" h="h-3" />
      </div>
    </div>
  );
}

/** A chart's plot area, in placeholder form. Same height as BarChart/LineChart's
    own default, so the panel doesn't grow when the real chart replaces it. */
function ChartSkeleton() {
  return <div className="skeleton h-55 w-full rounded-lg" />;
}

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
      <div className="border-b border-line/70 pb-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function Dashboard() {
  const { money, can } = useAdmin();
  // The figures describe one semester's membership list — the same one the
  // Members module is showing.
  const { selected: term, loading: termsLoading } = useTerms();
  // Poll at the tightest Filament interval (stats were 10s).
  const { data, loading, error } = useAdminResource<DashboardData>(
    termsLoading ? null : `/dashboard${term ? `?term=${term.id}` : ""}`,
    { pollMs: 10000 },
  );

  /* Deliberately not just `loading`: that flag starts true and never goes
     true again (see MembersList), so it describes the first fetch only —
     exactly the moment worth a skeleton for. A background poll refresh
     keeps the figures already on screen instead of blanking them. */
  const awaitingData = loading && !data;

  // Whether the payment-summary row will end up on screen is known before the
  // fetch resolves — it's gated on the same ability the backend gates it on
  // (App\Enums\Permission::ViewRevenue), already loaded with the officer's
  // session. Deciding the skeleton from it means the finance row's shape
  // shows up front rather than popping in only once `data` lands.
  const canViewRevenue = data ? data.canViewRevenue : can("finance.revenue");

  const stats = data?.stats;
  const revenueDesc = stats
    ? `${stats.paid} of ${stats.members} paid` +
      (stats.unpaid > 0 && stats.pendingRevenue !== null ? ` · ${stats.unpaid} pending ${money(stats.pendingRevenue)}` : "")
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Dashboard</h1>
        {data?.term ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {data.term.label}
            {data.term.isCurrent ? " · current membership list" : " · past membership list"}
          </p>
        ) : awaitingData ? (
          <p className="mt-1">
            <Bar w="w-48" />
          </p>
        ) : null}
      </div>

      {error && !data && <p className="py-4 text-sm text-red-400">{error}</p>}

      {awaitingData ? (
        <>
          {/* Headline stats. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
          </div>

          {/* Payment summary — only drawn for roles that will actually see it. */}
          {canViewRevenue && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => <StatCardSkeleton key={i} />)}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Members by year & section" description="Live headcount per class (3A / 3B / 4A / 4B).">
              <ChartSkeleton />
            </Panel>
            <Panel title="Registrations over time" description="New members per month (last 6 months).">
              <ChartSkeleton />
            </Panel>
          </div>
        </>
      ) : data && stats ? (
        <>
          {/* Headline stats. The revenue tile is finance-only. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Members" value={stats.members} description="registered members" icon={Users} tone="primary" />
            <StatCard label="3rd Year" value={stats.thirdYear} description="members" icon={GraduationCap} tone="info" />
            <StatCard label="4th Year" value={stats.fourthYear} description="members" icon={GraduationCap} tone="info" />
            {canViewRevenue && stats.revenue !== null ? (
              <StatCard
                label="Revenue collected"
                value={money(stats.revenue)}
                description={revenueDesc}
                icon={Banknote}
                tone={stats.unpaid > 0 ? "warning" : "success"}
              />
            ) : (
              <StatCard label="Paid members" value={stats.paid} description={`${stats.unpaid} unpaid`} icon={Users} tone={stats.unpaid > 0 ? "warning" : "success"} />
            )}
          </div>

          {/* Payment summary — finance roles only. */}
          {canViewRevenue && data.paymentSummary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Collected today" value={money(data.paymentSummary.today.amount)} description={`${data.paymentSummary.today.members} members · ${data.paymentSummary.today.label}`} icon={Banknote} tone={data.paymentSummary.today.members > 0 ? "success" : "info"} />
              <StatCard label="This week" value={money(data.paymentSummary.week.amount)} description={`${data.paymentSummary.week.members} members · ${data.paymentSummary.week.label}`} icon={CalendarDays} tone={data.paymentSummary.week.members > 0 ? "success" : "info"} />
              <StatCard label="This month" value={money(data.paymentSummary.month.amount)} description={`${data.paymentSummary.month.members} members · ${data.paymentSummary.month.label}`} icon={Calendar} tone={data.paymentSummary.month.members > 0 ? "success" : "info"} />
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Members by year & section" description="Live headcount per class (3A / 3B / 4A / 4B).">
              <BarChart labels={data.membersByClass.labels} data={data.membersByClass.data} />
            </Panel>
            <Panel title="Registrations over time" description="New members per month (last 6 months).">
              <LineChart labels={data.registrationsOverTime.labels} data={data.registrationsOverTime.data} />
            </Panel>
          </div>
        </>
      ) : null}

      {/* Calendar widget — same shared component every role sees. Rendered
          unconditionally rather than behind the dashboard fetch above: it
          fetches its own, unrelated `/events` resource and manages its own
          loading state, so gating it on the dashboard stats made it wait on
          a request it has nothing to do with. */}
      <UpcomingEvents />
    </div>
  );
}
