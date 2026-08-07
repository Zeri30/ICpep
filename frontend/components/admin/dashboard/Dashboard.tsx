"use client";

import {
  Banknote,
  Calendar,
  CalendarDays,
  GraduationCap,
  HandCoins,
  type LucideIcon,
  Users,
} from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import StatCard from "@/components/admin/dashboard/StatCard";
import UpcomingEvents from "@/components/admin/dashboard/UpcomingEvents";
import BarChart from "@/components/admin/ui/BarChart";
import LineChart from "@/components/admin/ui/LineChart";
import { Bar } from "@/components/admin/ui/Skeleton";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import { useDashboardResource } from "@/components/admin/dashboard/useDashboardResource";
import type { DashboardData } from "@/lib/adminTypes";

/* Mission Control layout: every figure, permission check, fetch, and poll
   below is identical to the previous dashboard — only where and how large
   each one renders has changed.

   The two numbers that most say "where does the chapter stand right now"
   (total membership, payment status) anchor the top of the page as
   oversized hero tiles. The schedule sits beside them as a tall column
   spanning both hero rows, so it reads as a live feed of what's next and
   what still needs an outcome recorded, not a footer widget scrolled past to
   reach — it already fetches and loads independently of the stats below
   (see UpcomingEvents), so it renders in that same spot regardless of
   whether the rest of this page is still loading. Everything with less
   time pressure — the 3rd/4th year split, the payment ticker, the trend
   charts — steps down in size and further down the page the less
   operationally urgent it is. */

/** One hero or supporting StatCard, in placeholder form, matching whichever
    size the real tile will render at so nothing shifts when it arrives. */
function StatCardSkeleton({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-card ${lg ? "p-6" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Bar w={lg ? "w-28" : "w-20"} h="h-3" />
        <span className={`skeleton block shrink-0 rounded-lg ${lg ? "size-11" : "size-9"}`} />
      </div>
      <div className={lg ? "mt-4" : "mt-3"}>
        <Bar w={lg ? "w-32" : "w-16"} h={lg ? "h-10" : "h-8"} />
      </div>
      <div className="mt-auto pt-1.5">
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

/** One line of the payment ticker, in placeholder form. */
function TickerRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="skeleton block size-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Bar w="w-24" h="h-3" />
        <Bar w="w-36" h="h-3" />
      </div>
      <Bar w="w-16" h="h-5" />
    </div>
  );
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

/** One row of the payment ticker — a feed line (icon, label + context, the
    figure) rather than its own tile, so three numbers that are really trend
    context for the hero tiles above read as a compact log, not three more
    things competing for the same attention. */
function TickerRow({
  icon: Icon,
  label,
  value,
  description,
  active,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  active: boolean;
}) {
  const accent = active ? "#22c55e" : "#3b82f6";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${accent}1f`, color: accent }}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground/80">{description}</p>
      </div>
      <span className="shrink-0 font-display text-lg font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const { money, can } = useAdmin();
  // The figures describe one semester's membership list — the same one the
  // Members module is showing.
  const { selected: term, initialTermId } = useTerms();
  // Fire right away rather than waiting on `/terms`: `selected` isn't known
  // yet on first paint, but `initialTermId` (read synchronously from
  // localStorage) is, and failing that, omitting `term` entirely gets the
  // server's own default (the current list) — either way this is never
  // wrong for longer than it takes `selected` to resolve, at which point its
  // real id takes over below and the path change refetches automatically.
  const termId = term?.id ?? initialTermId;
  // Poll at the tightest Filament interval (stats were 10s). Cached for a
  // few seconds behind the scenes (see useDashboardResource) so clicking
  // back into this module shortly after leaving it doesn't blank to a full
  // skeleton for figures that were already on screen a moment ago.
  const { data, loading, error } = useDashboardResource<DashboardData>(
    `/dashboard${termId ? `?term=${termId}` : ""}`,
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

      {/* Hero row — the headline KPIs, the year-level breakdown beneath them,
          and the live schedule feed spanning both. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <div className="sm:col-span-1 xl:col-span-4">
          {awaitingData ? (
            <StatCardSkeleton size="lg" />
          ) : data && stats ? (
            <StatCard
              size="lg"
              label="Members"
              value={stats.members}
              description="registered members"
              icon={Users}
              tone="primary"
            />
          ) : null}
        </div>

        <div className="sm:col-span-1 xl:col-span-4">
          {awaitingData ? (
            <StatCardSkeleton size="lg" />
          ) : data && stats ? (
            canViewRevenue && stats.revenue !== null ? (
              <StatCard
                size="lg"
                label="Revenue collected"
                value={money(stats.revenue)}
                description={revenueDesc}
                icon={Banknote}
                tone={stats.unpaid > 0 ? "warning" : "success"}
              />
            ) : (
              <StatCard
                size="lg"
                label="Paid members"
                value={stats.paid}
                description={`${stats.unpaid} unpaid`}
                icon={HandCoins}
                tone={stats.unpaid > 0 ? "warning" : "success"}
              />
            )
          ) : null}
        </div>

        {/* Always on screen regardless of the stats fetch above — it fetches
            its own /events resource and manages its own loading state, so
            gating it on the dashboard stats would make it wait on a request
            it has nothing to do with. Spanning both hero rows on xl+ is what
            gives it "live feed" weight instead of a footer afterthought. */}
        <div className="sm:col-span-2 xl:col-span-4 xl:row-span-2">
          <UpcomingEvents />
        </div>

        <div className="sm:col-span-1 xl:col-span-4">
          {awaitingData ? (
            <StatCardSkeleton />
          ) : data && stats ? (
            <StatCard label="3rd Year" value={stats.thirdYear} description="members" icon={GraduationCap} tone="info" />
          ) : null}
        </div>
        <div className="sm:col-span-1 xl:col-span-4">
          {awaitingData ? (
            <StatCardSkeleton />
          ) : data && stats ? (
            <StatCard label="4th Year" value={stats.fourthYear} description="members" icon={GraduationCap} tone="info" />
          ) : null}
        </div>
      </div>

      {/* Payment ticker — finance roles only, a compact feed of recent
          collections rather than three more full-size tiles: it's trend
          context for the revenue hero above, not a headline of its own. */}
      {canViewRevenue && (awaitingData || (data && stats && data.paymentSummary)) && (
        <section className="rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Recent collections
            </h2>
            {!awaitingData && (
              <span className="text-[11px] text-muted-foreground">Updates automatically</span>
            )}
          </div>
          <div className="mt-1 divide-y divide-line/40">
            {awaitingData ? (
              Array.from({ length: 3 }, (_, i) => <TickerRowSkeleton key={i} />)
            ) : data && stats && data.paymentSummary ? (
              <>
                <TickerRow
                  icon={Banknote}
                  label="Collected today"
                  value={money(data.paymentSummary.today.amount)}
                  description={`${data.paymentSummary.today.members} members · ${data.paymentSummary.today.label}`}
                  active={data.paymentSummary.today.members > 0}
                />
                <TickerRow
                  icon={CalendarDays}
                  label="This week"
                  value={money(data.paymentSummary.week.amount)}
                  description={`${data.paymentSummary.week.members} members · ${data.paymentSummary.week.label}`}
                  active={data.paymentSummary.week.members > 0}
                />
                <TickerRow
                  icon={Calendar}
                  label="This month"
                  value={money(data.paymentSummary.month.amount)}
                  description={`${data.paymentSummary.month.members} members · ${data.paymentSummary.month.label}`}
                  active={data.paymentSummary.month.members > 0}
                />
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* Charts — the slowest-moving figures on the page, and the least
          time-critical, so they anchor the bottom as reference detail. Like
          the original, absent entirely (not just empty) once loading has
          settled with nothing to show — the error message above already
          covers that case, so there's no empty panel shell under it. */}
      {(awaitingData || (data && stats)) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Members by year & section" description="Live headcount per class (3A / 3B / 4A / 4B).">
            {awaitingData ? (
              <ChartSkeleton />
            ) : data && stats ? (
              <BarChart labels={data.membersByClass.labels} data={data.membersByClass.data} />
            ) : null}
          </Panel>
          <Panel title="Registrations over time" description="New members per month (last 6 months).">
            {awaitingData ? (
              <ChartSkeleton />
            ) : data && stats ? (
              <LineChart labels={data.registrationsOverTime.labels} data={data.registrationsOverTime.data} />
            ) : null}
          </Panel>
        </div>
      )}
    </div>
  );
}
