"use client";

/* Payment History — read-only ledger open to every administrator: filters
   (Event, Section), search, and pagination. Amounts are shown per row
   (descriptive), never summed. */

import { CheckCircle2, History, PencilLine, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import DataTable, { type Column } from "@/components/admin/ui/DataTable";
import ExportMenu from "@/components/admin/ui/ExportMenu";
import Pagination from "@/components/admin/ui/Pagination";
import { Bar, PaginationSkeleton, Pill } from "@/components/admin/ui/Skeleton";
import { apiGet, markModuleViewed, useAdminResource } from "@/lib/adminApi";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import TermSelect from "@/components/admin/TermSelect";
import { formatDateTime } from "@/lib/adminFormat";
import type { Paginated, PaymentRow } from "@/lib/adminTypes";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";

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

const KIND_LABEL: Record<PaymentRow["kind"], string> = {
  payment1: "Payment 1",
  payment2: "Payment 2",
};

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
  const { selected: term, initialTermId, isViewingPast } = useTerms();
  // Fire right away rather than waiting on `/terms` to resolve — see
  // Dashboard.tsx/MembersList.tsx for the same pattern and its reasoning.
  const termId = term?.id ?? initialTermId;
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [action, setAction] = useState("");
  const [kind, setKind] = useState("");
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
  // landing on a page number that may not exist in it. Tracks `termId` (the
  // guess-or-resolved id the query string actually uses), not `term?.id`
  // directly — see MembersList.tsx for why that distinction matters.
  const [renderedTermId, setRenderedTermId] = useState(termId);
  if (termId !== renderedTermId) {
    setRenderedTermId(termId);
    setPage(1);
  }

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    // The ledger is scoped to the same semester as the Members module, so a
    // term's collected fees and its headcount describe the same people.
    if (termId) p.set("term", String(termId));
    if (debounced) p.set("search", debounced);
    if (action) p.set("action", action);
    if (kind) p.set("kind", kind);
    // Same combined year+section code the Members List filters on ("3A"..
    // "4B"), resolved server-side against the two denormalised columns.
    if (klass) p.set("class", klass);
    p.set("page", String(page));
    return p.toString();
  }, [termId, debounced, action, kind, klass, page]);

  const { data, error, fetching, mutate } = useAdminResource<Paginated<PaymentRow>>(`/payments?${qs}`);
  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  // Same filters as `qs`, minus pagination — a poll always asks about every
  // row those filters match, not just whichever page is on screen, since a
  // new event always lands on page 1 regardless of what page is displayed.
  const changesQs = useMemo(() => {
    const p = new URLSearchParams(qs);
    p.delete("page");
    return p.toString();
  }, [qs]);

  // Same filters/search as the table, minus pagination — an export always
  // covers every matching transaction, not just the page currently on
  // screen. See MembersList.tsx for the same pattern.
  const exportQueryString = useMemo(() => {
    const p = new URLSearchParams(qs);
    p.delete("page");
    return p.toString();
  }, [qs]);

  // Which semester the rows in `data` were fetched for — same reset-on-change
  // pattern as MembersList, so a term switch never shows the previous term's
  // ledger under the new term's heading while the new page is in flight.
  // Tracks `termId`, not `term?.id` — see MembersList.tsx.
  const [dataTermId, setDataTermId] = useState(termId);
  const [lastData, setLastData] = useState(data);
  if (data !== lastData) {
    setLastData(data);
    setDataTermId(termId);
  }
  const otherTerm = data !== null && termId !== dataTermId;
  const rows = otherTerm ? [] : (data?.data ?? []);
  const awaitingRows = !error && (data === null || otherTerm);

  /**
   * Real-time sync: every few seconds, ask the server for ledger rows added
   * since the last check (see PaymentController::changes, already filtered
   * to match `changesQs`) and prepend them if the officer is on page 1 —
   * where a new event always lands — so a payment another officer records
   * elsewhere shows up here without a manual refresh, without ever
   * refetching the page. Skipped on any other page: a row landing there
   * isn't missing, it just isn't on the page in front of them yet.
   *
   * `pollRef` always calls through to the latest closure (current
   * `changesQs`, `page` and `mutate`) kept fresh below, so the interval
   * itself is set up once per term rather than needing to restart on every
   * filter/page change — restarting would reset the `since` checkpoint to
   * "now" and risk a change landing in the gap being missed. Paused while
   * the tab is hidden and caught back up on becoming visible again — see
   * useVisibilityInterval.
   */
  const pollRef = useRef<(since: string) => Promise<string>>(async (since) => since);
  useEffect(() => {
    pollRef.current = async (since: string): Promise<string> => {
      try {
        const p = new URLSearchParams(changesQs);
        p.set("since", since);
        const { added, since: next } = await apiGet<{ added: PaymentRow[]; since: string }>(`/payments/changes?${p}`);

        if (added.length > 0 && page === 1) {
          mutate((prev) => {
            if (!prev) return prev;
            const data = [...added, ...prev.data].slice(0, prev.meta.per_page);
            return {
              data,
              meta: {
                ...prev.meta,
                total: prev.meta.total + added.length,
                // Page 1 always starts at row 1 once it holds anything — this
                // branch only ever runs on page 1 (see the guard above), so
                // recomputing both from `data.length` is safe even coming
                // from an empty filtered page (from/to were null).
                from: data.length === 0 ? null : 1,
                to: data.length === 0 ? null : data.length,
              },
            };
          });
        }

        return next;
      } catch {
        // Best-effort — retry from the same checkpoint next tick rather than
        // silently skipping ahead over whatever landed during the failure.
        return since;
      }
    };
  });

  const sinceRef = useRef(new Date().toISOString());
  useEffect(() => {
    if (!termId) return;
    sinceRef.current = new Date().toISOString();
  }, [termId]);

  useVisibilityInterval(async () => {
    sinceRef.current = await pollRef.current(sinceRef.current);
  }, termId ? 10_000 : null);

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
    {
      key: "event",
      header: "Event",
      width: "14%",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <EventBadge action={r.action} paymentTerm={r.paymentTerm} />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[r.kind]}</span>
        </div>
      ),
      // Two lines, same reasoning as Member's — the cell now stacks the
      // event badge over which payment batch it was.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          <Pill w="w-20" />
          <Bar w="w-14" h="h-3" />
        </div>
      ),
    },
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
    {
      key: "actor",
      header: "By",
      width: "12%",
      render: (r) => (
        <div className="leading-tight">
          <p className="whitespace-nowrap font-medium text-foreground">{r.actorName ?? r.actor ?? "System"}</p>
          {r.actorRoleLabel && <p className="text-[11px] text-muted-foreground">{r.actorRoleLabel}</p>}
        </div>
      ),
      // Two lines, because the cell has two — name over role.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          <Bar w="w-24" />
          <Bar w="w-16" h="h-3" />
        </div>
      ),
    },
  ];

  return (
    // Fills the space below the topbar and scrolls rows internally — see
    // MembersList for the height maths.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Payment History</h1>
          {term && <p className="mt-1 text-sm text-muted-foreground">{term.label}</p>}
        </div>
        {/* Open to every role that can see the ledger — reading it is all it takes to export it. */}
        <ExportMenu base="/api/admin/payments/export" queryString={exportQueryString} />
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
        <select value={kind} onChange={(e) => reset(setKind)(e.target.value)} className={selectCls} aria-label="Payment batch">
          <option value="">All batches</option>
          <option value="payment1">Payment 1</option>
          <option value="payment2">Payment 2</option>
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
