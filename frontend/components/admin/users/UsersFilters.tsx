"use client";

import { Search, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";

export type UserFilters = {
  search: string;
  role: string;
  status: string;
};

export const EMPTY_USER_FILTERS: UserFilters = { search: "", role: "", status: "" };

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

export default function UsersFilters({
  value,
  onChange,
}: {
  value: UserFilters;
  onChange: (next: UserFilters) => void;
}) {
  const { meta } = useAdmin();
  const set = (patch: Partial<UserFilters>) => onChange({ ...value, ...patch });
  const dirty = value.search || value.role || value.status;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative w-full sm:w-auto">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search name, username or email…"
          className={`${selectCls} w-full pl-9 sm:w-64`}
        />
      </div>

      <select value={value.role} onChange={(e) => set({ role: e.target.value })} className={selectCls} aria-label="Role">
        <option value="">All roles</option>
        {meta.roles.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <select value={value.status} onChange={(e) => set({ status: e.target.value })} className={selectCls} aria-label="Status">
        <option value="">Any status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      {dirty && (
        <button
          onClick={() => onChange(EMPTY_USER_FILTERS)}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
