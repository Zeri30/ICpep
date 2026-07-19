"use client";

import { Search, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";

export type MemberFilters = {
  search: string;
  class: string;
  payment: string;
  trashed: string;
};

export const EMPTY_FILTERS: MemberFilters = {
  search: "",
  class: "",
  payment: "",
  trashed: "",
};

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

export default function MembersFilters({
  value,
  onChange,
}: {
  value: MemberFilters;
  onChange: (next: MemberFilters) => void;
}) {
  const { meta } = useAdmin();
  const set = (patch: Partial<MemberFilters>) => onChange({ ...value, ...patch });

  const dirty = value.search || value.class || value.payment || value.trashed;

  // A fragment, not a wrapper: the controls sit directly in the caller's flex
  // row so the bulk-action bar can share it and align to the far end.
  return (
    <>
      <div className="relative w-full sm:w-auto">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search name or email…"
          className={`${selectCls} w-full pl-9 sm:w-56`}
        />
      </div>

      <select value={value.class} onChange={(e) => set({ class: e.target.value })} className={selectCls} aria-label="Year & Section">
        <option value="">All classes</option>
        {meta.classOptions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={value.payment} onChange={(e) => set({ payment: e.target.value })} className={selectCls} aria-label="Payment">
        <option value="">All payment</option>
        <option value="paid">Paid</option>
        <option value="unpaid">Unpaid</option>
      </select>

      <select value={value.trashed} onChange={(e) => set({ trashed: e.target.value })} className={selectCls} aria-label="Trashed">
        <option value="">Active members</option>
        <option value="only">Deleted members</option>
      </select>

      {dirty && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <X size={13} /> Clear
        </button>
      )}
    </>
  );
}
