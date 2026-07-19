"use client";

/* Members List — filters + search + sort + pagination, per-row actions (toggle
   paid, view, edit, downloads, delete/restore) and bulk actions.

   Every action that moves money is confirmed first and acts only on the ticked
   rows. Nothing here operates on the whole filtered set: a single click should
   not be able to rewrite a semester's payment records. */

import Image from "next/image";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import TermBar from "@/components/admin/members/TermBar";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import DataTable, { type Column, type SortState } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import MembersFilters, { EMPTY_FILTERS, type MemberFilters } from "@/components/admin/members/MembersFilters";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { Member, Paginated } from "@/lib/adminTypes";

type Confirm =
  | { kind: "delete"; member: Member }
  | { kind: "restore"; member: Member }
  | { kind: "togglePaid"; member: Member }
  | { kind: "bulk"; action: "delete" | "restore" }
  /** Payment carries its counts so the dialog can say exactly what will change. */
  | { kind: "payment"; action: "paid" | "unpaid"; eligible: number; skipped: number }
  | null;

function PaymentPill({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">
      <CheckCircle2 size={12} /> Paid
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Clock size={12} /> Unpaid
    </span>
  );
}

export default function MembersList() {
  const { notify, can } = useAdmin();
  // Which semester's membership list is being shown. Shared with the Dashboard
  // and the payment ledger so all three describe the same roster.
  const { selected: term, loading: termsLoading } = useTerms();
  const canEdit = can("members.edit");
  const canPay = can("members.payment");
  const canSelect = canEdit || canPay; // any bulk action needs one of these

  const [filters, setFilters] = useState<MemberFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  // Keyed by id but holding the row itself: selection survives paging, so the
  // payment actions need each member's current paid state to report honestly
  // what they will change — the ids alone can't answer that off-page.
  const [selected, setSelected] = useState<Map<number, Member>>(new Map());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // Debounce only the free-text search; selects apply immediately.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Switching lists is a different dataset, not a filter of the current one —
  // start at page 1 with nothing carried over from the previous list's rows.
  // Adjusted during render (React's documented reset-on-change pattern) rather
  // than in an effect, so no render ever pairs the new term with a stale page.
  const [renderedTermId, setRenderedTermId] = useState(term?.id);
  if (term?.id !== renderedTermId) {
    setRenderedTermId(term?.id);
    setPage(1);
    setSelected(new Map());
  }

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (term) p.set("term", String(term.id));
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filters.class) p.set("class", filters.class);
    if (filters.payment) p.set("payment", filters.payment);
    if (filters.trashed) p.set("trashed", filters.trashed);
    if (sort) {
      p.set("sort", sort.key);
      p.set("direction", sort.direction);
    }
    p.set("page", String(page));
    return p.toString();
  }, [term, debouncedSearch, filters, sort, page]);

  // Hold off until the term is known, so the table never flashes the current
  // list's members while a past list is the one selected.
  const { data, loading, error, refresh } = useAdminResource<Paginated<Member>>(
    termsLoading ? null : `/members?${queryString}`,
  );

  // Any filter/sort change returns to page 1 and drops the selection.
  const changeFilters = (next: MemberFilters) => {
    setFilters(next);
    setPage(1);
    setSelected(new Map());
  };
  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
    setPage(1);
  };

  const rows = data?.data ?? [];

  /* -------------------------------------------------------------- mutations */

  async function run(action: () => Promise<unknown>, success: string, body?: string) {
    try {
      await action();
      await refresh();
      notify(success, body ? { body } : undefined);
    } catch (e) {
      notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
    }
  }

  /**
   * Open the confirmation for a payment change over the selection.
   *
   * Refuses before asking rather than after: a confirm dialog that leads to "0
   * updated" is worse than being told up front that nothing is ticked. The
   * eligible count excludes members already in the target state, matching what
   * the backend actually does, so the dialog never promises more than happens.
   */
  function requestPayment(action: "paid" | "unpaid") {
    if (selected.size === 0) {
      notify("No members selected", {
        tone: "warning",
        body: `Tick the checkbox beside each member you want to mark as ${action}.`,
      });
      return;
    }

    const members = [...selected.values()];
    const eligible = members.filter((m) => (action === "paid" ? !m.isPaid : m.isPaid));

    if (eligible.length === 0) {
      notify("Nothing to update", {
        tone: "warning",
        body:
          members.length === 1
            ? `The selected member is already ${action}.`
            : `All ${members.length} selected members are already ${action}.`,
      });
      return;
    }

    setConfirm({ kind: "payment", action, eligible: eligible.length, skipped: members.length - eligible.length });
  }

  async function confirmAction() {
    if (!confirm) return;
    const ids = [...selected.keys()];

    if (confirm.kind === "delete") {
      await run(() => apiSend("DELETE", `/members/${confirm.member.id}`), "Member deleted");
    } else if (confirm.kind === "restore") {
      await run(() => apiSend("POST", `/members/${confirm.member.id}/restore`), "Member restored");
    } else if (confirm.kind === "togglePaid") {
      const wasPaid = confirm.member.isPaid;
      await run(
        () => apiSend("POST", `/members/${confirm.member.id}/toggle-paid`),
        wasPaid ? "Marked as unpaid" : "Marked as paid",
      );
    } else if (confirm.kind === "bulk") {
      await run(async () => {
        const { count } = await apiSend<{ count: number }>("POST", "/members/bulk", { ids, action: confirm.action });
        setSelected(new Map());
        return count;
      }, "Bulk update applied");
    } else if (confirm.kind === "payment") {
      const { action, eligible, skipped } = confirm;
      await run(
        async () => {
          await apiSend("POST", "/members/bulk", { ids, action });
          setSelected(new Map());
        },
        // The endpoint counts every id it was handed, including ones it skipped,
        // so the figure reported here is our own — the members that changed.
        `${eligible} member${eligible === 1 ? "" : "s"} marked as ${action}`,
        skipped > 0 ? `${skipped} already ${action} — left unchanged.` : undefined,
      );
    }

    setConfirm(null);
  }

  /* ---------------------------------------------------------- selection ui */

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Map(s);
      // Scoped to this page: untick clears only what's visible, leaving any
      // off-page selection the officer built up intact.
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.set(r.id, r));
      return n;
    });
  const toggleOne = (m: Member) =>
    setSelected((s) => {
      const n = new Map(s);
      if (n.has(m.id)) n.delete(m.id);
      else n.set(m.id, m);
      return n;
    });

  const showRestoreBulk = filters.trashed === "with" || filters.trashed === "only";

  /* ------------------------------------------------------------- columns */

  const columns: Column<Member>[] = [
    ...(canSelect
      ? [
          {
            key: "select",
            // Select-all rides in the column header rather than a row of its
            // own above the table — same control, one less band of chrome.
            header: (
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="size-4 accent-primary align-middle"
                aria-label="Select all on this page"
                title="Select all on this page"
              />
            ),
            render: (m: Member) => (
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleOne(m)}
                className="size-4 accent-primary"
                aria-label={`Select ${m.fullName}`}
              />
            ),
          },
        ]
      : []),
    {
      key: "photo",
      header: "Photo",
      render: (m) =>
        m.photoUrl ? (
          <Image src={m.photoUrl} alt="" width={40} height={40} className="size-10 rounded-full object-cover" unoptimized />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {m.givenName?.[0]}
            {m.surname?.[0]}
          </span>
        ),
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (m) => (
        <div>
          <p className="font-medium text-foreground">{m.fullName}</p>
          <p className="text-xs text-muted-foreground">{m.email}</p>
        </div>
      ),
    },
    { key: "class", header: "Class", render: (m) => <Badge tone="red">{m.classCode}</Badge> },
    { key: "year", header: "Year", render: (m) => <Badge tone="dark">{m.yearLevel}</Badge> },
    { key: "section", header: "Section", sortable: true, render: (m) => <span className="text-secondary-foreground">{m.section}</span> },
    { key: "phone", header: "Phone", render: (m) => <span className="text-secondary-foreground">{m.phone}</span> },
    { key: "paidAt", header: "Payment", sortable: true, render: (m) => <PaymentPill paid={m.isPaid} /> },
    { key: "createdAt", header: "Registered", sortable: true, render: (m) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(m.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (m) =>
        m.deletedAt ? (
          canEdit ? (
            <button
              onClick={() => setConfirm({ kind: "restore", member: m })}
              title="Undo delete"
              className="grid size-8 place-items-center rounded-md text-green-400 transition-colors hover:bg-green-500/10"
            >
              <RotateCcw size={16} />
            </button>
          ) : null
        ) : (
          <div className="flex items-center justify-end gap-1">
            {canPay && (
              <button
                onClick={() => setConfirm({ kind: "togglePaid", member: m })}
                title={m.isPaid ? "Mark as unpaid" : "Mark as paid"}
                className={`grid size-8 place-items-center rounded-md transition-colors ${m.isPaid ? "text-muted-foreground hover:bg-white/5" : "text-green-400 hover:bg-green-500/10"}`}
              >
                {m.isPaid ? <RotateCcw size={16} /> : <Banknote size={16} />}
              </button>
            )}
            <RowMenu
              open={menuFor === m.id}
              onOpen={() => setMenuFor(m.id)}
              onClose={() => setMenuFor(null)}
              member={m}
              canEdit={canEdit}
              onDelete={() => setConfirm({ kind: "delete", member: m })}
            />
          </div>
        ),
    },
  ];

  return (
    // On a wide screen the module fills exactly the space below the 72px topbar
    // (less the main element's py-8) and scrolls the rows inside the table, so
    // the page itself never scrolls and the pager stays put. Narrow screens keep
    // the natural flow, where a page scroll is the better behaviour.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <TermBar />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Members List</h1>
          {term && <p className="mt-1 text-sm text-muted-foreground">{term.label}</p>}
        </div>
        {/* Named for what it does. "Mark all" read as "everything in the list"
            and was acting on the whole filtered set, which is not something an
            officer should be able to trigger from a single click. */}
        {canPay && (
          <button
            onClick={() => requestPayment("paid")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3.5 py-2 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/20 sm:w-auto"
          >
            <Banknote size={16} /> Mark selected as paid
            {selected.size > 0 && (
              <span className="rounded-full bg-green-500/20 px-1.5 text-xs tabular-nums">{selected.size}</span>
            )}
          </button>
        )}
      </div>

      {/* Filters and the bulk actions share one row: the selection controls
          replace nothing and push nothing down, so the table keeps its height
          whether or not rows are selected. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <MembersFilters value={filters} onChange={changeFilters} />

        {selected.size > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm sm:ml-auto sm:w-auto">
            <span className="font-medium text-foreground">{selected.size} selected</span>
            <div className="mx-0.5 h-4 w-px bg-line" />
            {canPay && <BulkBtn onClick={() => requestPayment("paid")}>Mark paid</BulkBtn>}
            {canPay && <BulkBtn onClick={() => requestPayment("unpaid")}>Mark unpaid</BulkBtn>}
            {canEdit && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "delete" })} tone="danger">Delete</BulkBtn>}
            {canEdit && showRestoreBulk && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "restore" })}>Undo delete</BulkBtn>}
            <button
              onClick={() => setSelected(new Map())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <DataTable
        fill
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        loading={loading && !data}
        error={error}
        sort={sort}
        onSort={onSort}
        emptyHeading="No members found"
        emptyDescription="Try clearing the filters, or wait for new registrations from the public form."
        footer={data ? <Pagination meta={data.meta} onPage={setPage} /> : null}
      />

      {/* Confirmations */}
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Delete member"
        description="This removes the member from the list. The record is kept (soft delete) and can be undone from the “Only deleted” filter."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "restore"}
        title="Restore member"
        description="Bring this member back to the members list?"
        confirmLabel="Restore"
        tone="success"
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "bulk"}
        title={confirm?.kind === "bulk" && confirm.action === "delete" ? "Delete selected" : "Restore selected"}
        description={`This will ${confirm?.kind === "bulk" ? confirm.action : ""} ${selected.size} selected member${selected.size === 1 ? "" : "s"}.`}
        confirmLabel="Apply"
        tone={confirm?.kind === "bulk" && confirm.action === "delete" ? "danger" : "primary"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      {/* Per-row toggle. Money changing hands is worth a beat of confirmation,
          and an accidental click here is otherwise silent and immediate. */}
      <ConfirmDialog
        open={confirm?.kind === "togglePaid"}
        title={confirm?.kind === "togglePaid" && confirm.member.isPaid ? "Mark as unpaid" : "Mark as paid"}
        description={
          confirm?.kind === "togglePaid" ? (
            confirm.member.isPaid ? (
              <>
                Clear the payment on <span className="text-foreground">{confirm.member.fullName}</span>? The fee
                is reversed in the payment history and the member returns to unpaid.
              </>
            ) : (
              <>
                Record the membership fee for <span className="text-foreground">{confirm.member.fullName}</span>?
                Today becomes the payment date.
              </>
            )
          ) : undefined
        }
        confirmLabel={confirm?.kind === "togglePaid" && confirm.member.isPaid ? "Mark as unpaid" : "Mark as paid"}
        tone={confirm?.kind === "togglePaid" && confirm.member.isPaid ? "danger" : "success"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={confirm?.kind === "payment"}
        title={confirm?.kind === "payment" && confirm.action === "unpaid" ? "Mark selected as unpaid" : "Mark selected as paid"}
        description={
          confirm?.kind === "payment" ? (
            <>
              {confirm.action === "paid" ? (
                <>
                  Record the membership fee for{" "}
                  <span className="text-foreground">
                    {confirm.eligible} selected member{confirm.eligible === 1 ? "" : "s"}
                  </span>
                  , with today as the payment date.
                </>
              ) : (
                <>
                  Clear the payment on{" "}
                  <span className="text-foreground">
                    {confirm.eligible} selected member{confirm.eligible === 1 ? "" : "s"}
                  </span>
                  . Each fee is reversed in the payment history.
                </>
              )}
              {confirm.skipped > 0 && (
                <>
                  {" "}
                  {confirm.skipped} already {confirm.action} and will be left unchanged.
                </>
              )}
            </>
          ) : undefined
        }
        confirmLabel={confirm?.kind === "payment" && confirm.action === "unpaid" ? "Mark as unpaid" : "Mark as paid"}
        tone={confirm?.kind === "payment" && confirm.action === "unpaid" ? "danger" : "success"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function BulkBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
        tone === "danger"
          ? "text-red-400 hover:bg-red-500/10"
          : "text-secondary-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function RowMenu({
  open,
  onOpen,
  onClose,
  member,
  canEdit,
  onDelete,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  member: Member;
  canEdit: boolean;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground";

  return (
    <div ref={ref} className="relative">
      <button onClick={open ? onClose : onOpen} title="More" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <Link href={`/admin/members/${member.id}`} className={item} onClick={onClose}>
            <Eye size={15} /> View
          </Link>
          {canEdit && (
            <Link href={`/admin/members/${member.id}/edit`} className={item} onClick={onClose}>
              <Pencil size={15} /> Edit
            </Link>
          )}
          <a href={`/api/admin/members/${member.id}/download/picture`} className={item} onClick={onClose}>
            <Download size={15} /> Download photo
          </a>
          <a href={`/api/admin/members/${member.id}/download/signature`} className={item} onClick={onClose}>
            <Download size={15} /> Download signature
          </a>
          {canEdit && (
            <button onClick={() => { onClose(); onDelete(); }} className={`${item} text-red-400 hover:text-red-300`}>
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
