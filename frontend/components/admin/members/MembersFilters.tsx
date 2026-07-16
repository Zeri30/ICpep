"use client";

import { Search, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";

export type MemberFilters = {
  search: string;
  class: string;
  payment: string;
  trashed: string;
  dateField: string;
  from: string;
  until: string;
};

export const EMPTY_FILTERS: MemberFilters = {
  search: "",
  class: "",
  payment: "",
  trashed: "",
  dateField: "created_at",
  from: "",
  until: "",
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

  const dirty =
    value.search || value.class || value.payment || value.trashed || value.from || value.until;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search name or email…"
          className={`${selectCls} w-56 pl-9`}
        />
      </div>

      <select value={value.class} onChange={(e) => set({ class: e.target.value })} className={selectCls} aria-label="Year & Section">
        <option value="">All classes</option>
        {meta.classOptions.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={value.payment} onChange={(e) => set({ payment: e.target.value })} className={selectCls} aria-label="Payment">
        <option value="">Any payment</option>
        <option value="paid">Paid</option>
        <option value="unpaid">Unpaid</option>
      </select>

      <select value={value.trashed} onChange={(e) => set({ trashed: e.target.value })} className={selectCls} aria-label="Trashed">
        <option value="">Active members</option>
        <option value="with">With deleted</option>
        <option value="only">Only deleted</option>
      </select>

      <div className="flex items-center gap-1.5">
        <select value={value.dateField} onChange={(e) => set({ dateField: e.target.value })} className={selectCls} aria-label="Date field">
          <option value="created_at">Registered</option>
          <option value="paid_at">Paid</option>
          <option value="birthday">Birthday</option>
        </select>
        <input type="date" value={value.from} onChange={(e) => set({ from: e.target.value })} className={selectCls} aria-label="From" />
        <span className="text-muted-foreground">–</span>
        <input type="date" value={value.until} onChange={(e) => set({ until: e.target.value })} className={selectCls} aria-label="Until" />
      </div>

      {dirty && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
