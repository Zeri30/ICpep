"use client";

import { Search, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import RoleOptions from "@/components/admin/users/RoleOptions";

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
    <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">
      <div className="relative w-full sm:w-auto">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search name or email…"
          className={`${selectCls} w-full pl-9 sm:w-64`}
        />
      </div>

      {/* Below `sm` this is a two-column grid, so role/status/clear line up
          in a clean block instead of raggedly wrapping one-by-one next to a
          full-width search bar — same trick as MembersFilters. `sm:contents`
          drops the wrapper at `sm`+, handing its children back to this flex row. */}
      <div className="grid w-full grid-cols-2 gap-2 sm:contents">
        {/* Grouped by family — see RoleOptions. */}
        <select value={value.role} onChange={(e) => set({ role: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Role">
          <option value="">All roles</option>
          <RoleOptions roles={meta.roles} />
        </select>

        <select value={value.status} onChange={(e) => set({ status: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>

        {dirty && (
          <button
            onClick={() => onChange(EMPTY_USER_FILTERS)}
            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:col-span-1 sm:justify-start"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
