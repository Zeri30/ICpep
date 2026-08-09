"use client";

/* User Management — administrator accounts. Filters (search + role + status),
   sort, pagination, and per-row actions: edit, privileges, activate/deactivate,
   reset password, and permanent delete. Every destructive action confirms first,
   and the signed-in officer can never deactivate or delete their own row.

   Privileges is the odd one out: it is reached from a row but edits that
   account's *role*, so it affects every account holding it. The modal states
   that rather than the menu, since the menu has no room to explain it. */

import {
  KeyRound,
  LogOut,
  MoreVertical,
  Pencil,
  Power,
  SlidersHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import DataTable, { type Column, type SortState } from "@/components/admin/ui/DataTable";
import Pagination from "@/components/admin/ui/Pagination";
import { Bar, Circle, PaginationSkeleton, Pill } from "@/components/admin/ui/Skeleton";
import UsersFilters, { EMPTY_USER_FILTERS, type UserFilters } from "@/components/admin/users/UsersFilters";
import NewUserModal from "@/components/admin/users/NewUserModal";
import EditUserModal from "@/components/admin/users/EditUserModal";
import ResetPasswordModal from "@/components/admin/users/ResetPasswordModal";
import RoleBadge from "@/components/admin/users/RoleBadge";
import RolePrivilegesModal from "@/components/admin/users/RolePrivilegesModal";
import { apiSend, markModuleViewed } from "@/lib/adminApi";
import { useUsersListResource } from "@/components/admin/users/useUsersListResource";
import { formatDateTime } from "@/lib/adminFormat";
import type { AdminUser, Paginated } from "@/lib/adminTypes";
import { useOutsideClick } from "@/lib/useOutsideClick";

type Confirm =
  | { kind: "toggle"; user: AdminUser }
  | { kind: "delete"; user: AdminUser }
  | { kind: "logout-all" }
  | null;

/**
 * How many placeholder rows to draw while the first page is in flight.
 *
 * 20 because that's UserController's `perPage` default — the skeleton then
 * occupies exactly the height the real rows are about to take, so nothing
 * jumps when they land. See MembersList for the fuller rationale.
 */
const SKELETON_ROWS = 20;

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
  const [privilegesFor, setPrivilegesFor] = useState<AdminUser | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);

  // Opening the list clears its sidebar badge — see markModuleViewed.
  useEffect(() => {
    markModuleViewed("users");
  }, []);

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

  const { data, loading, fetching, error, refresh } = useUsersListResource<Paginated<AdminUser>>(`/users?${queryString}`);

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
    } else if (confirm.kind === "logout-all") {
      await run(
        () => apiSend("POST", "/users/logout-all-sessions"),
        "Every other administrator has been signed out",
      );
    }
    setConfirm(null);
  }

  /**
   * Gate on `resetAvailableAt` before ever opening the confirm dialog — the
   * account is on the reset-password cooldown (UserController::RESET_COOLDOWN_DAYS)
   * until that time, so there's nothing the dialog could do here but fail.
   * The backend enforces the same window regardless, in case this data is
   * stale by the time the click lands.
   */
  function requestReset(user: AdminUser) {
    if (user.resetAvailableAt && new Date(user.resetAvailableAt) > new Date()) {
      notify("Password reset is on cooldown", {
        tone: "warning",
        body: `${user.name} was already reset recently. Try again after ${formatDateTime(user.resetAvailableAt)}.`,
      });
      return;
    }
    setResetFor(user);
  }

  async function resetPassword(): Promise<string> {
    if (!resetFor) throw new Error("No account selected.");
    // Let the modal surface any error by rethrowing; it stays open afterwards
    // to show the generated password, so this does not close it.
    const { generatedPassword } = await apiSend<{ generatedPassword: string }>(
      "POST",
      `/users/${resetFor.id}/reset-password`,
    );
    await refresh();
    notify("Password reset");
    return generatedPassword;
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
      // The avatar circle sets the row's height, so its placeholder is
      // load-bearing — see MembersList's Photo column for why.
      skeleton: (
        <div className="flex items-center gap-3">
          <Circle size="size-9" />
          <Bar w="w-32" />
        </div>
      ),
    },
    { key: "email", header: "Email", render: (u) => <span className="text-secondary-foreground">{u.email}</span>, skeleton: <Bar w="w-40" /> },
    { key: "role", header: "Role", sortable: true, render: (u) => <RoleBadge role={u.role} label={u.roleLabel} />, skeleton: <Pill w="w-24" /> },
    { key: "status", header: "Status", render: (u) => <StatusPill active={u.isActive} />, skeleton: <Pill w="w-20" /> },
    { key: "lastLogin", header: "Last Login", sortable: true, render: (u) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(u.lastLoginAt)}</span>, skeleton: <Bar w="w-40" /> },
    { key: "createdAt", header: "Created", sortable: true, render: (u) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(u.createdAt)}</span>, skeleton: <Bar w="w-40" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      // Same square icon-button the real row ends with, so the column keeps
      // its width instead of collapsing to nothing and shoving the rest left.
      skeleton: (
        <div className="flex justify-end">
          <span className="skeleton inline-block size-8 rounded-md" />
        </div>
      ),
      render: (u) => (
        <RowMenu
          open={menuFor === u.id}
          onOpen={() => setMenuFor(u.id)}
          onClose={() => setMenuFor(null)}
          user={u}
          onEdit={() => setEditing(u)}
          onPrivileges={() => setPrivilegesFor(u)}
          onToggle={() => setConfirm({ kind: "toggle", user: u })}
          onReset={() => requestReset(u)}
          onDelete={() => setConfirm({ kind: "delete", user: u })}
        />
      ),
    },
  ];

  return (
    // Fills the space below the topbar and scrolls rows internally — see
    // MembersList for the height maths.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <div>
        <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">User Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administrator accounts and their access.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <UsersFilters value={filters} onChange={changeFilters} />
        {/* A 2-col grid on mobile instead of a flex row: two `w-full` buttons
            in a nowrap flex row fight for the same 100% width and get squeezed
            into an unreadable sliver each, so width is handled by the grid
            column instead and the flex row only takes over at `sm`+. */}
        <div className="grid w-full grid-cols-2 gap-2.5 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            onClick={() => setConfirm({ kind: "logout-all" })}
            title="Force every other signed-in administrator to sign back in — useful after a permissions or role change"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <LogOut size={16} /> Log out all admins
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent"
          >
            <UserPlus size={16} /> New administrator
          </button>
        </div>
      </div>

      <DataTable
        fill
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        loading={loading && !data}
        skeletonRows={SKELETON_ROWS}
        error={error}
        sort={sort}
        onSort={onSort}
        emptyHeading="No administrators found"
        emptyDescription="Try clearing the filters, or add a new administrator account."
        footer={
          loading && !data ? (
            <PaginationSkeleton />
          ) : data ? (
            <Pagination meta={data.meta} onPage={setPage} disabled={fetching} />
          ) : null
        }
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
      <ConfirmDialog
        open={confirm?.kind === "logout-all"}
        title="Log out all admins"
        description={`Every other signed-in administrator, on every device, will be signed out and have to log back in. You’ll stay signed in on this device. Type "Confirm" below to go ahead.`}
        confirmLabel="Log everyone out"
        tone="danger"
        typeToConfirm="Confirm"
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
        onConfirm={resetPassword}
        onClose={() => setResetFor(null)}
      />

      {/* Edits the row's role, not the row — see the note at the top. */}
      <RolePrivilegesModal user={privilegesFor} onClose={() => setPrivilegesFor(null)} />
    </div>
  );
}

function RowMenu({
  open,
  onOpen,
  onClose,
  user,
  onEdit,
  onPrivileges,
  onToggle,
  onReset,
  onDelete,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  user: AdminUser;
  onEdit: () => void;
  onPrivileges: () => void;
  onToggle: () => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose, open);

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
          {/* Roleless accounts have nothing to configure. */}
          {user.role ? (
            <button onClick={() => { onClose(); onPrivileges(); }} className={item}>
              <SlidersHorizontal size={15} /> Privileges
            </button>
          ) : (
            <button type="button" className={disabled} title="This account has no role" disabled>
              <SlidersHorizontal size={15} /> Privileges
            </button>
          )}
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
