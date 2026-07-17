"use client";

/* Members List — the React parity of the Filament resource: filters + search +
   sort + pagination, per-row actions (toggle paid, view, edit, downloads,
   delete/restore), bulk actions, and "Mark all as paid" over the filtered set. */

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
  | { kind: "bulk"; action: "paid" | "unpaid" | "delete" | "restore" }
  | { kind: "markAll" }
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
  const canEdit = can("members.edit");
  const canPay = can("members.payment");
  const canSelect = canEdit || canPay; // any bulk action needs one of these

  const [filters, setFilters] = useState<MemberFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // Debounce only the free-text search; selects apply immediately.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
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
  }, [debouncedSearch, filters, sort, page]);

  const { data, loading, error, refresh } = useAdminResource<Paginated<Member>>(
    `/members?${queryString}`,
  );

  // Any filter/sort change returns to page 1 and drops the selection.
  const changeFilters = (next: MemberFilters) => {
    setFilters(next);
    setPage(1);
    setSelected(new Set());
  };
  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
    setPage(1);
  };

  const rows = data?.data ?? [];
  const filterPayload = () => ({
    class: filters.class,
    payment: filters.payment,
    trashed: filters.trashed,
    search: debouncedSearch,
  });

  /* -------------------------------------------------------------- mutations */

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      await refresh();
      notify(success);
    } catch (e) {
      notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
    }
  }

  const togglePaid = (m: Member) =>
    run(() => apiSend("POST", `/members/${m.id}/toggle-paid`), m.isPaid ? "Marked as unpaid" : "Marked as paid");

  async function confirmAction() {
    if (!confirm) return;
    const ids = [...selected];
    if (confirm.kind === "delete") {
      await run(() => apiSend("DELETE", `/members/${confirm.member.id}`), "Member deleted");
    } else if (confirm.kind === "restore") {
      await run(() => apiSend("POST", `/members/${confirm.member.id}/restore`), "Member restored");
    } else if (confirm.kind === "bulk") {
      await run(async () => {
        const { count } = await apiSend<{ count: number }>("POST", "/members/bulk", { ids, action: confirm.action });
        setSelected(new Set());
        return count;
      }, "Bulk update applied");
    } else if (confirm.kind === "markAll") {
      await run(async () => {
        const { count } = await apiSend<{ count: number }>("POST", "/members/mark-all-paid", filterPayload());
        notify("All filtered members marked as paid", { body: `${count} member(s) updated.` });
        return count;
      }, "Done");
    }
    setConfirm(null);
  }

  /* ---------------------------------------------------------- selection ui */

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const showRestoreBulk = filters.trashed === "with" || filters.trashed === "only";

  /* ------------------------------------------------------------- columns */

  const columns: Column<Member>[] = [
    ...(canSelect
      ? [
          {
            key: "select",
            header: "",
            render: (m: Member) => (
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleOne(m.id)}
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
                onClick={() => togglePaid(m)}
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Members List</h1>
        {canPay && (
          <button
            onClick={() => setConfirm({ kind: "markAll" })}
            className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3.5 py-2 text-sm font-semibold text-green-400 transition-colors hover:bg-green-500/20"
          >
            <Banknote size={16} /> Mark all as paid
          </button>
        )}
      </div>

      <MembersFilters value={filters} onChange={changeFilters} />

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">{selected.size} selected</span>
          <div className="mx-1 h-4 w-px bg-line" />
          {canPay && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "paid" })}>Mark paid</BulkBtn>}
          {canPay && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "unpaid" })}>Mark unpaid</BulkBtn>}
          {canEdit && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "delete" })} tone="danger">Delete</BulkBtn>}
          {canEdit && showRestoreBulk && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "restore" })}>Undo delete</BulkBtn>}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      )}

      {canSelect && (
        <div className="flex items-center gap-2 px-1">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4 accent-primary" aria-label="Select all" />
          <span className="text-xs text-muted-foreground">Select all on this page</span>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        loading={loading && !data}
        error={error}
        sort={sort}
        onSort={onSort}
        emptyHeading="No members found"
        emptyDescription="Try clearing the filters, or wait for new registrations from the public form."
      />

      {data && <Pagination meta={data.meta} onPage={setPage} />}

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
        title="Apply to selected"
        description={`This will ${confirm?.kind === "bulk" ? confirm.action : ""} ${selected.size} selected member(s).`}
        confirmLabel="Apply"
        tone={confirm?.kind === "bulk" && confirm.action === "delete" ? "danger" : "primary"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "markAll"}
        title="Mark all filtered members as paid"
        description="Every member matching the current filters that hasn't paid yet will be marked as paid, with today as the payment date. Members already paid keep their date."
        confirmLabel="Mark all as paid"
        tone="success"
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
