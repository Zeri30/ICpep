"use client";

/* User Management — administrator accounts. Filters (search + role + status),
   sort, pagination, and per-row actions: edit, activate/deactivate, reset
   password, and permanent delete. Every destructive action confirms first, and
   the signed-in officer can never deactivate or delete their own row. */

import {
  KeyRound,
  MoreVertical,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import DataTable, { type Column, type SortState } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import UsersFilters, { EMPTY_USER_FILTERS, type UserFilters } from "@/components/admin/users/UsersFilters";
import NewUserModal from "@/components/admin/users/NewUserModal";
import EditUserModal from "@/components/admin/users/EditUserModal";
import ResetPasswordModal from "@/components/admin/users/ResetPasswordModal";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { AdminUser, Paginated } from "@/lib/adminTypes";

type Confirm =
  | { kind: "toggle"; user: AdminUser }
  | { kind: "delete"; user: AdminUser }
  | null;

// The two roles that can manage administrator accounts get the accent badge.
/* Roles that can manage accounts, highlighted in the table. Mirrors the
   users.manage grant in App\Enums\UserRole. */
const MANAGER_ROLES = new Set(["programming_team"]);

function RoleBadge({ user }: { user: AdminUser }) {
  const isManager = user.role ? MANAGER_ROLES.has(user.role) : false;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isManager
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-line bg-white/5 text-secondary-foreground"
      }`}
    >
      {isManager && <ShieldCheck size={12} />}
      {user.roleLabel ?? user.role ?? "—"}
    </span>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">
      <span className="size-1.5 rounded-full bg-green-400" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" /> Inactive
    </span>
  );
}

export default function UsersList() {
  const { notify } = useAdmin();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filters.role) p.set("role", filters.role);
    if (filters.status) p.set("status", filters.status);
    if (sort) {
      p.set("sort", sort.key);
      p.set("direction", sort.direction);
    }
    p.set("page", String(page));
    return p.toString();
  }, [debouncedSearch, filters, sort, page]);

  const { data, loading, error, refresh } = useAdminResource<Paginated<AdminUser>>(`/users?${queryString}`);

  const changeFilters = (next: UserFilters) => {
    setFilters(next);
    setPage(1);
  };
  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
    setPage(1);
  };

  const rows = data?.data ?? [];

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

  async function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "toggle") {
      const wasActive = confirm.user.isActive;
      await run(
        () => apiSend("POST", `/users/${confirm.user.id}/toggle-active`),
        wasActive ? "Account deactivated" : "Account activated",
      );
    } else if (confirm.kind === "delete") {
      await run(() => apiSend("DELETE", `/users/${confirm.user.id}`), "Account permanently deleted");
    }
    setConfirm(null);
  }

  async function resetPassword(password: string, password_confirmation: string) {
    if (!resetFor) return;
    // Let the modal surface any error by rethrowing; only close on success.
    await apiSend("POST", `/users/${resetFor.id}/reset-password`, { password, password_confirmation });
    notify("Password reset");
    setResetFor(null);
  }

  /* ------------------------------------------------------------- columns */

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Full Name",
      sortable: true,
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full bg-secondary text-xs font-bold uppercase text-muted-foreground">
            {(u.name || "?").slice(0, 2)}
          </span>
          <div>
            <p className="font-medium text-foreground">
              {u.name}
              {u.isSelf && <span className="ml-2 text-[11px] font-normal text-muted-foreground">(you)</span>}
            </p>
          </div>
        </div>
      ),
    },
    { key: "email", header: "Email", render: (u) => <span className="text-secondary-foreground">{u.email}</span> },
    { key: "role", header: "Role", sortable: true, render: (u) => <RoleBadge user={u} /> },
    { key: "status", header: "Status", render: (u) => <StatusPill active={u.isActive} /> },
    { key: "lastLogin", header: "Last Login", sortable: true, render: (u) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(u.lastLoginAt)}</span> },
    { key: "createdAt", header: "Created", sortable: true, render: (u) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(u.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (u) => (
        <RowMenu
          open={menuFor === u.id}
          onOpen={() => setMenuFor(u.id)}
          onClose={() => setMenuFor(null)}
          user={u}
          onEdit={() => setEditing(u)}
          onToggle={() => setConfirm({ kind: "toggle", user: u })}
          onReset={() => setResetFor(u)}
          onDelete={() => setConfirm({ kind: "delete", user: u })}
        />
      ),
    },
  ];

  return (
    // Fills the space below the topbar and scrolls rows internally — see
    // MembersList for the height maths.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administrator accounts and their access.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent sm:w-auto"
        >
          <UserPlus size={16} /> New administrator
        </button>
      </div>

      <UsersFilters value={filters} onChange={changeFilters} />

      <DataTable
        fill
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        loading={loading && !data}
        error={error}
        sort={sort}
        onSort={onSort}
        emptyHeading="No administrators found"
        emptyDescription="Try clearing the filters, or add a new administrator account."
        footer={data ? <Pagination meta={data.meta} onPage={setPage} /> : null}
      />

      {/* Confirmations */}
      <ConfirmDialog
        open={confirm?.kind === "toggle"}
        title={confirm?.kind === "toggle" && confirm.user.isActive ? "Deactivate account" : "Activate account"}
        description={
          confirm?.kind === "toggle"
            ? confirm.user.isActive
              ? `${confirm.user.name} will no longer be able to sign in until reactivated. Their account and history are kept.`
              : `${confirm.user.name} will be able to sign in to the admin again.`
            : ""
        }
        confirmLabel={confirm?.kind === "toggle" && confirm.user.isActive ? "Deactivate" : "Activate"}
        tone={confirm?.kind === "toggle" && confirm.user.isActive ? "danger" : "success"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Permanently delete account"
        description={
          confirm?.kind === "delete"
            ? `This permanently removes ${confirm.user.name}'s account. This cannot be undone — deactivate instead if you only need to revoke access temporarily.`
            : ""
        }
        confirmLabel="Delete permanently"
        tone="danger"
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />

      <NewUserModal
        open={creating}
        onCreated={refresh}
        onClose={() => setCreating(false)}
      />

      <EditUserModal
        user={editing}
        onSaved={refresh}
        onClose={() => setEditing(null)}
      />

      <ResetPasswordModal
        open={!!resetFor}
        userName={resetFor?.name ?? null}
        onSubmit={resetPassword}
        onClose={() => setResetFor(null)}
      />
    </div>
  );
}

function RowMenu({
  open,
  onOpen,
  onClose,
  user,
  onEdit,
  onToggle,
  onReset,
  onDelete,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  user: AdminUser;
  onEdit: () => void;
  onToggle: () => void;
  onReset: () => void;
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
  const disabled = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted-foreground/50 cursor-not-allowed";

  return (
    <div ref={ref} className="relative">
      <button onClick={open ? onClose : onOpen} title="More" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <button onClick={() => { onClose(); onEdit(); }} className={item}>
            <Pencil size={15} /> Edit account
          </button>
          <button onClick={() => { onClose(); onReset(); }} className={item}>
            <KeyRound size={15} /> Reset password
          </button>
          {user.isSelf ? (
            <button type="button" className={disabled} title="You can’t deactivate your own account" disabled>
              <Power size={15} /> Deactivate
            </button>
          ) : (
            <button onClick={() => { onClose(); onToggle(); }} className={item}>
              <Power size={15} /> {user.isActive ? "Deactivate" : "Activate"}
            </button>
          )}
          <div className="my-1 h-px bg-line/60" />
          {user.isSelf ? (
            <button type="button" className={disabled} title="You can’t delete your own account" disabled>
              <Trash2 size={15} /> Delete
            </button>
          ) : (
            <button onClick={() => { onClose(); onDelete(); }} className={`${item} text-red-400 hover:text-red-300`}>
              <Trash2 size={15} /> Delete permanently
            </button>
          )}
        </div>
      )}
    </div>
  );
}
