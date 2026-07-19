"use client";

/* The membership-list picker, shared by every module that reads per-semester
   data. Selecting here changes the term for the whole admin (the selection
   lives in MembershipTermProvider), so switching in Payment History and then
   opening Members List keeps you on the same semester rather than silently
   snapping back to the current one. */

import { ChevronDown, CircleDot } from "lucide-react";
import { useTerms } from "@/components/admin/MembershipTermProvider";

export default function TermSelect({
  /** Show the "Active list" pill beside the control. */
  showBadge = true,
  className = "",
}: {
  showBadge?: boolean;
  className?: string;
}) {
  const { terms, selected, selectTerm } = useTerms();

  return (
    <div className={`flex w-full flex-wrap items-center gap-3 sm:w-auto ${className}`}>
      {/* A native select is as wide as its longest option, and these labels run
          to "2026–2027 Semester 1 (Current) — 128 members". Full-width on a
          phone so it truncates inside the viewport instead of overflowing it. */}
      <div className="relative w-full sm:w-auto">
        <select
          value={selected?.id ?? ""}
          onChange={(e) => selectTerm(Number(e.target.value))}
          disabled={!terms.length}
          aria-label="Membership list"
          className="w-full max-w-full appearance-none truncate rounded-lg border border-line bg-card py-2.5 pl-4 pr-11 text-sm font-medium text-foreground outline-none transition-colors hover:border-primary/40 focus:border-primary/60 focus:ring-2 focus:ring-primary/30 disabled:opacity-60 sm:w-auto"
        >
          {/* Ordered by the API with the current list first. */}
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {t.isCurrent ? " (Current)" : ""}
              {typeof t.memberCount === "number"
                ? ` — ${t.memberCount} member${t.memberCount === 1 ? "" : "s"}`
                : ""}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {showBadge && selected?.isCurrent && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-green-400">
          <CircleDot size={12} /> Active list
        </span>
      )}
    </div>
  );
}
