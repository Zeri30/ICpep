"use client";

import { Loader2, Search, X } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";

export type MemberFilters = {
  search: string;
  class: string;
  year: string;
  payment: string;
  trashed: string;
};

export const EMPTY_FILTERS: MemberFilters = {
  search: "",
  class: "",
  year: "",
  payment: "",
  trashed: "",
};

const selectCls =
  "rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

export default function MembersFilters({
  value,
  onChange,
  searching = false,
}: {
  value: MemberFilters;
  onChange: (next: MemberFilters) => void;
  /** A search request for the typed-in term is pending or in flight — swaps
      the search icon for a spinner so a slow lookup reads as "loading",
      not as the input having silently dropped the keystroke. */
  searching?: boolean;
}) {
  const { meta } = useAdmin();
  const set = (patch: Partial<MemberFilters>) => onChange({ ...value, ...patch });

  const dirty = value.search || value.class || value.year || value.payment || value.trashed;

  // A fragment, not a wrapper: the controls sit directly in the caller's flex
  // row so the bulk-action bar can share it and align to the far end.
  return (
    <>
      <div className="relative w-full sm:w-auto">
        {searching ? (
          <Loader2
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-primary"
          />
        ) : (
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          value={value.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search by name, email, student ID, or phone number…"
          className={`${selectCls} w-full pl-9 sm:w-96`}
        />
      </div>

      {/* Below `sm` this is a two-column grid, so the four selects line up
          in a clean block instead of raggedly wrapping one-by-one next to a
          full-width search bar. `sm:contents` drops the wrapper from the
          flow at `sm`+, handing its children back to the parent's flex row
          exactly as before. */}
      <div className="grid w-full grid-cols-2 gap-2 sm:contents">
        <select value={value.class} onChange={(e) => set({ class: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Year & Section">
          <option value="">All classes</option>
          {meta.classOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={value.year} onChange={(e) => set({ year: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Year">
          <option value="">All years</option>
          {meta.yearLevels.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select value={value.payment} onChange={(e) => set({ payment: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Payment">
          <option value="">All Payments</option>
          <option value="p1_paid">Payment 1 – Paid</option>
          <option value="p1_unpaid">Payment 1 – Unpaid</option>
          <option value="p2_paid">Payment 2 – Paid</option>
          <option value="p2_unpaid">Payment 2 – Unpaid</option>
          <option value="both_paid">Both Paid</option>
          <option value="both_unpaid">Both Unpaid</option>
          <option value="p1_paid_p2_unpaid">Payment 1 Paid, Payment 2 Unpaid</option>
          <option value="p1_unpaid_p2_paid">Payment 1 Unpaid, Payment 2 Paid</option>
        </select>

        <select value={value.trashed} onChange={(e) => set({ trashed: e.target.value })} className={`${selectCls} w-full sm:w-auto`} aria-label="Trashed">
          <option value="">Active members</option>
          {/* Soft-deleted rows only surface here for 30 days after deletion (see
              Application::DELETED_RETENTION_DAYS on the backend) — the record
              itself is kept forever, only its visibility here expires. */}
          <option value="only">Deleted members</option>
        </select>

        {dirty && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:col-span-1 sm:justify-start"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>
    </>
  );
}
