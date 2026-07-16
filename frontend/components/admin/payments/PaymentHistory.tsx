"use client";

/* Payment History — the React parity of the read-only Filament ledger: filters
   (Event, Section, Date range), search, and pagination. Amounts are shown per
   row (descriptive), never summed. */

import { CheckCircle2, PencilLine, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import DataTable, { type Column } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import { useAdminResource } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { Paginated, PaymentRow } from "@/lib/adminTypes";

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

const EVENT = {
  paid: { label: "Paid", cls: "border-green-500/30 bg-green-500/10 text-green-400", Icon: CheckCircle2 },
  revoked: { label: "Revoked", cls: "border-red-500/30 bg-red-500/10 text-red-400", Icon: XCircle },
  adjusted: { label: "Date adjusted", cls: "border-amber-accent/30 bg-amber-accent/10 text-amber-accent", Icon: PencilLine },
} as const;

function EventBadge({ action }: { action: PaymentRow["action"] }) {
  const e = EVENT[action] ?? EVENT.adjusted;
  const Icon = e.Icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${e.cls}`}>
      <Icon size={12} /> {e.label}
    </span>
  );
}

export default function PaymentHistory() {
  const { meta, money } = useAdmin();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [section, setSection] = useState("");
  const [dateField, setDateField] = useState("effective_at");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (action) p.set("action", action);
    if (section) p.set("section", section);
    if (from || until) {
      p.set("dateField", dateField);
      if (from) p.set("from", from);
      if (until) p.set("until", until);
    }
    p.set("page", String(page));
    return p.toString();
  }, [debounced, action, section, dateField, from, until, page]);

  const { data, loading, error } = useAdminResource<Paginated<PaymentRow>>(`/payments?${qs}`);
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const amountCell = (v: number) => {
    if (v > 0) return <span className="font-semibold text-green-400">+{money(v)}</span>;
    if (v < 0) return <span className="font-semibold text-red-400">−{money(Math.abs(v))}</span>;
    return <span className="text-muted-foreground">—</span>;
  };

  const columns: Column<PaymentRow>[] = [
    {
      key: "member",
      header: "Member",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.memberName}</p>
          {r.section && <p className="text-xs text-muted-foreground">{r.section}</p>}
        </div>
      ),
    },
    { key: "event", header: "Event", render: (r) => <EventBadge action={r.action} /> },
    { key: "amount", header: "Amount", align: "right", render: (r) => amountCell(r.amount) },
    { key: "paidAt", header: "Payment date", render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(r.effectiveAt)}</span> },
    { key: "recorded", header: "Recorded", render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(r.recordedAt)}</span> },
    { key: "actor", header: "By", render: (r) => <span className="text-secondary-foreground">{r.actor ?? "System"}</span> },
    { key: "note", header: "Note", render: (r) => <span className="text-xs text-muted-foreground">{r.note ?? "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Payment History</h1>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Search member or officer…" className={`${selectCls} w-56 pl-9`} />
        </div>
        <select value={action} onChange={(e) => reset(setAction)(e.target.value)} className={selectCls} aria-label="Event">
          <option value="">Any event</option>
          <option value="paid">Paid</option>
          <option value="revoked">Revoked</option>
          <option value="adjusted">Date adjusted</option>
        </select>
        <select value={section} onChange={(e) => reset(setSection)(e.target.value)} className={selectCls} aria-label="Section">
          <option value="">Any section</option>
          {meta.sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <select value={dateField} onChange={(e) => reset(setDateField)(e.target.value)} className={selectCls} aria-label="Date field">
            <option value="effective_at">Payment date</option>
            <option value="created_at">Recorded</option>
          </select>
          <input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} className={selectCls} aria-label="From" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={until} onChange={(e) => reset(setUntil)(e.target.value)} className={selectCls} aria-label="Until" />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        rowKey={(r) => r.id}
        loading={loading && !data}
        error={error}
        emptyHeading="No payments recorded yet"
        emptyDescription="Marking a member as paid in the Members List records it here."
      />
      {data && <Pagination meta={data.meta} onPage={setPage} />}
    </div>
  );
}
