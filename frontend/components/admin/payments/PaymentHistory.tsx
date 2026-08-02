"use client";

/* Payment History — read-only ledger open to every administrator: filters
   (Event, Section), search, and pagination. Amounts are shown per row
   (descriptive), never summed. */

import { CheckCircle2, History, PencilLine, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import DataTable, { type Column } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import { Bar, PaginationSkeleton, Pill } from "@/components/admin/ui/Skeleton";
import { markModuleViewed, useAdminResource } from "@/lib/adminApi";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import TermSelect from "@/components/admin/TermSelect";
import { formatDateTime } from "@/lib/adminFormat";
import type { Paginated, PaymentRow } from "@/lib/adminTypes";

/**
 * How many placeholder rows to draw while the first page is in flight.
 *
 * 20 because that's PaymentController's `perPage` default — the skeleton
 * then occupies exactly the height the real rows are about to take, so
 * nothing jumps when they land. See MembersList for the fuller rationale.
 */
const SKELETON_ROWS = 20;

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

const EVENT = {
  paid: { label: "Paid", cls: "border-green-500/30 bg-green-500/10 text-green-400", Icon: CheckCircle2 },
  revoked: { label: "Revoked", cls: "border-red-500/30 bg-red-500/10 text-red-400", Icon: XCircle },
  adjusted: { label: "Date adjusted", cls: "border-amber-accent/30 bg-amber-accent/10 text-amber-accent", Icon: PencilLine },
} as const;

function EventBadge({ action, paymentTerm }: { action: PaymentRow["action"]; paymentTerm: PaymentRow["paymentTerm"] }) {
  const e = EVENT[action] ?? EVENT.adjusted;
  const Icon = e.Icon;
  // Which semester this event belongs to — "Current" for the active roster,
  // otherwise the school-year it happened under.
  const suffix = paymentTerm ? (paymentTerm.isCurrent ? "(Current)" : `(${paymentTerm.shortLabel})`) : "";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${e.cls}`}>
      <Icon size={12} /> {e.label}{suffix}
    </span>
  );
}

export default function PaymentHistory() {
  const { meta, money } = useAdmin();
  const { selected: term, loading: termsLoading, isViewingPast } = useTerms();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [klass, setKlass] = useState("");
  const [page, setPage] = useState(1);

  // Opening the list clears its sidebar badge — see markModuleViewed.
  useEffect(() => {
    markModuleViewed("payments");
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(id);
  }, [search]);

  // A different list is a different dataset — go back to page 1 rather than
  // landing on a page number that may not exist in it.
  const [renderedTermId, setRenderedTermId] = useState(term?.id);
  if (term?.id !== renderedTermId) {
    setRenderedTermId(term?.id);
    setPage(1);
  }

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    // The ledger is scoped to the same semester as the Members module, so a
    // term's collected fees and its headcount describe the same people.
    if (term) p.set("term", String(term.id));
    if (debounced) p.set("search", debounced);
    if (action) p.set("action", action);
    // Same combined year+section code the Members List filters on ("3A"..
    // "4B"), resolved server-side against the two denormalised columns.
    if (klass) p.set("class", klass);
    p.set("page", String(page));
    return p.toString();
  }, [term, debounced, action, klass, page]);

  const { data, error, fetching } = useAdminResource<Paginated<PaymentRow>>(
    termsLoading ? null : `/payments?${qs}`,
  );
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  // Which semester the rows in `data` were fetched for — same reset-on-change
  // pattern as MembersList, so a term switch never shows the previous term's
  // ledger under the new term's heading while the new page is in flight.
  const [dataTermId, setDataTermId] = useState(term?.id);
  const [lastData, setLastData] = useState(data);
  if (data !== lastData) {
    setLastData(data);
    setDataTermId(term?.id);
  }
  const otherTerm = data !== null && term?.id !== dataTermId;
  const rows = otherTerm ? [] : (data?.data ?? []);
  const awaitingRows = !error && (data === null || otherTerm);

  const amountCell = (v: number) => {
    if (v > 0) return <span className="font-semibold text-green-400">+{money(v)}</span>;
    if (v < 0) return <span className="font-semibold text-red-400">−{money(Math.abs(v))}</span>;
    return <span className="text-muted-foreground">—</span>;
  };

  const columns: Column<PaymentRow>[] = [
    {
      key: "member",
      header: "Member",
      width: "24%",
      render: (r) => (
        <div>
          <p className="font-medium text-foreground">{r.memberName}</p>
          {r.section && <p className="text-xs text-muted-foreground">{r.section}</p>}
        </div>
      ),
      // Two lines, because the cell has two — name over section.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          <Bar w="w-32" />
          <Bar w="w-16" h="h-3" />
        </div>
      ),
    },
    { key: "event", header: "Event", width: "14%", render: (r) => <EventBadge action={r.action} paymentTerm={r.paymentTerm} />, skeleton: <Pill w="w-20" /> },
    {
      key: "amount",
      header: "Amount",
      width: "16%",
      // Left-aligned like every other column, so the fixed-width layout's
      // default padding gives every column boundary the same visual gap —
      // right-aligning just this one pushed its short text away from its
      // neighbors on one side and left a wide gap on the other.
      render: (r) => amountCell(r.amount),
      skeleton: <Bar w="w-16" />,
    },
    {
      key: "yearLevel",
      header: "Year Level",
      width: "16%",
      render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{r.yearLevel ?? "—"}</span>,
      skeleton: <Bar w="w-12" />,
    },
    {
      key: "recorded",
      header: "Recorded",
      width: "18%",
      render: (r) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(r.recordedAt)}</span>,
      skeleton: <Bar w="w-40" />,
    },
    { key: "actor", header: "By", width: "12%", render: (r) => <span className="text-secondary-foreground">{r.actor ?? "System"}</span>, skeleton: <Bar w="w-24" /> },
  ];

  return (
    // Fills the space below the topbar and scrolls rows internally — see
    // MembersList for the height maths.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Payment History</h1>
        {term && <p className="mt-1 text-sm text-muted-foreground">{term.label}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="Search member or officer…" className={`${selectCls} w-full pl-9 sm:w-72`} />
        </div>
        <select value={action} onChange={(e) => reset(setAction)(e.target.value)} className={selectCls} aria-label="Event">
          <option value="">All</option>
          <option value="paid">Paid</option>
          <option value="revoked">Revoked</option>
        </select>
        <select value={klass} onChange={(e) => reset(setKlass)(e.target.value)} className={selectCls} aria-label="Year & Section">
          <option value="">All </option>
          {meta.classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Which semester's ledger this is. Same control as the Members
            module, sharing the same selection, so switching here follows you
            there. Pushed to the far right of the filter row, away from the
            search/event/section controls it doesn't narrow alongside. */}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <TermSelect />
          {isViewingPast && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-secondary/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <History size={12} /> Past list
            </span>
          )}
        </div>
      </div>

      <DataTable
        fill
        fixedLayout
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={awaitingRows}
        skeletonRows={SKELETON_ROWS}
        error={error}
        emptyHeading="No payments recorded yet"
        emptyDescription="Marking a member as paid in the Members List records it here."
        footer={
          awaitingRows ? (
            <PaginationSkeleton />
          ) : data ? (
            <Pagination meta={data.meta} onPage={setPage} disabled={fetching} />
          ) : null
        }
      />
    </div>
  );
}
