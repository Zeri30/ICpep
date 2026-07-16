"use client";

/* Activity Log — the React parity of the read-only Filament history: an action
   filter, search, and pagination. */

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable, { type Column } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import { useAdminResource } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { ActivityRow, Paginated } from "@/lib/adminTypes";

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (action) p.set("action", action);
    p.set("page", String(page));
    return p.toString();
  }, [debounced, action, page]);

  const { data, loading, error } = useAdminResource<Paginated<ActivityRow>>(`/activity?${qs}`);

  const columns: Column<ActivityRow>[] = [
    { key: "when", header: "When", render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(r.createdAt)}</span> },
    { key: "action", header: "Action", render: (r) => <ActionBadge action={r.action} /> },
    { key: "description", header: "Description", render: (r) => <span className="text-foreground">{r.description}</span> },
    { key: "actor", header: "By", render: (r) => <span className="text-secondary-foreground">{r.actor ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Activity Log</h1>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search description or officer…" className={`${selectCls} w-64 pl-9`} />
        </div>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectCls} aria-label="Action">
          <option value="">All actions</option>
          <option value="registered">Registered</option>
          <option value="updated">Edited</option>
          <option value="deleted">Deleted</option>
          <option value="restored">Restored</option>
          <option value="login">Login</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={loading && !data}
        error={error}
        emptyHeading="No activity yet"
      />
      {data && <Pagination meta={data.meta} onPage={setPage} />}
    </div>
  );
}
