"use client";

/* Activity Log — the React parity of the read-only Filament history: an action
   filter, search, and pagination. */

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import { Bar, PaginationSkeleton, Pill } from "@/components/admin/ui/Skeleton";
import { markModuleViewed, useAdminResource } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { ActivityRow, Paginated } from "@/lib/adminTypes";

/** Local calendar date as YYYY-MM-DD — what a `<input type="date">` reads and
    writes, and what the backend's `from`/`until` (whereDate) expect. Not
    `toISOString`, which is UTC and can name the wrong day for anyone not at
    UTC+0 (e.g. 11pm PHT is already tomorrow in UTC). */
function dateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today, and N-1 days ago — the two ends of an "N days" preset, both inclusive. */
function lastNDays(n: number): { from: string; until: string } {
  const until = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (n - 1));
  return { from: dateInput(from), until: dateInput(until) };
}

const DATE_PRESETS: { label: string; range: () => { from: string; until: string } }[] = [
  { label: "Today", range: () => lastNDays(1) },
  { label: "Last 7 days", range: () => lastNDays(7) },
  { label: "Last 30 days", range: () => lastNDays(30) },
];

/**
 * How many placeholder rows to draw while the first page is in flight.
 *
 * 20 because that's ActivityController's `perPage` default — the skeleton
 * then occupies exactly the height the real rows are about to take, so
 * nothing jumps when they land. See MembersList for the fuller rationale.
 */
const SKELETON_ROWS = 20;

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

// Same colour language as the Filament resource.
const ACTION_CLS: Record<string, string> = {
  registered: "border-green-500/30 bg-green-500/10 text-green-400",
  restored: "border-green-500/30 bg-green-500/10 text-green-400",
  paid: "border-green-500/30 bg-green-500/10 text-green-400",
  deleted: "border-amber-accent/30 bg-amber-accent/10 text-amber-accent",
  updated: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  login: "border-line bg-white/5 text-secondary-foreground",
  // User Management.
  user_created: "border-green-500/30 bg-green-500/10 text-green-400",
  user_activated: "border-green-500/30 bg-green-500/10 text-green-400",
  user_updated: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  password_reset: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  user_deactivated: "border-amber-accent/30 bg-amber-accent/10 text-amber-accent",
  user_deleted: "border-red-500/30 bg-red-500/10 text-red-400",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_CLS[action] ?? "border-line bg-white/5 text-secondary-foreground";
  const label = action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>{label}</span>;
}

export default function ActivityLog() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);

  // Opening the log clears its sidebar badge — see markModuleViewed.
  useEffect(() => {
    markModuleViewed("activity");
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (action) p.set("action", action);
    if (from) p.set("from", from);
    if (until) p.set("until", until);
    p.set("page", String(page));
    return p.toString();
  }, [debounced, action, from, until, page]);

  const { data, loading, error } = useAdminResource<Paginated<ActivityRow>>(`/activity?${qs}`);

  const applyPreset = (range: { from: string; until: string }) => {
    setFrom(range.from);
    setUntil(range.until);
    setPage(1);
  };
  const activePreset = DATE_PRESETS.find((p) => {
    const r = p.range();
    return r.from === from && r.until === until;
  })?.label;
  const clearDates = () => {
    setFrom("");
    setUntil("");
    setPage(1);
  };

  const columns: Column<ActivityRow>[] = [
    { key: "when", header: "When", render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(r.createdAt)}</span>, skeleton: <Bar w="w-32" /> },
    { key: "action", header: "Action", render: (r) => <ActionBadge action={r.action} />, skeleton: <Pill w="w-24" /> },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="text-foreground">{r.description}</span>,
      // The widest column by far — a short bar here would leave the column
      // collapsed to its header's width and every other column crowded left.
      skeleton: <Bar w="w-64" />,
    },
    {
      key: "actor",
      header: "By",
      render: (r) => (
        <div className="leading-tight">
          <p className="whitespace-nowrap font-medium text-foreground">{r.actorName ?? r.actor ?? "—"}</p>
          {r.actorRoleLabel && <p className="text-[11px] text-muted-foreground">{r.actorRoleLabel}</p>}
        </div>
      ),
      // Two lines, because the cell has two — name over role.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          <Bar w="w-28" />
          <Bar w="w-20" h="h-3" />
        </div>
      ),
    },
  ];

  return (
    // Fills the space below the topbar and scrolls rows internally — see
    // MembersList for the height maths.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Activity Log</h1>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search description or officer…" className={`${selectCls} w-full pl-9 sm:w-64`} />
        </div>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectCls} aria-label="Action">
          <option value="">All actions</option>
          <optgroup label="Members">
            <option value="registered">Registered</option>
            <option value="updated">Edited</option>
            <option value="deleted">Deleted</option>
            <option value="restored">Restored</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </optgroup>
          <optgroup label="User management">
            <option value="user_created">User created</option>
            <option value="user_updated">User edited</option>
            <option value="user_activated">User activated</option>
            <option value="user_deactivated">User deactivated</option>
            <option value="user_deleted">User deleted</option>
            <option value="password_reset">Password reset</option>
          </optgroup>
          <option value="login">Login</option>
        </select>

        <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p.range())}
            className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              activePreset === p.label
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-line text-secondary-foreground hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}

        <input
          type="date"
          value={from}
          max={until || undefined}
          onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          aria-label="From date"
          className={selectCls}
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={until}
          min={from || undefined}
          onChange={(e) => { setUntil(e.target.value); setPage(1); }}
          aria-label="Until date"
          className={selectCls}
        />

        {(from || until) && (
          <button
            onClick={clearDates}
            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <X size={13} /> Clear dates
          </button>
        )}
      </div>

      <DataTable
        fill
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={loading && !data}
        skeletonRows={SKELETON_ROWS}
        error={error}
        emptyHeading="No activity yet"
        footer={
          loading && !data ? (
            <PaginationSkeleton />
          ) : data ? (
            <Pagination meta={data.meta} onPage={setPage} />
          ) : null
        }
      />
    </div>
  );
}
