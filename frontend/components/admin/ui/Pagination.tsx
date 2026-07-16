"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type PageMeta = {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
  from: number | null;
  to: number | null;
};

/** Compact prev/next pager with a "x–y of n" readout, driven by a Laravel
    paginator's meta block. */
export default function Pagination({
  meta,
  onPage,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
}) {
  const { current_page, last_page, total, from, to } = meta;
  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 border-t border-line/60 px-4 py-3 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {from ?? 0}–{to ?? 0} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPage(current_page - 1)}
          disabled={current_page <= 1}
          aria-label="Previous page"
          className="grid size-8 place-items-center rounded-md border border-line/60 transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="tabular-nums">
          {current_page} / {last_page}
        </span>
        <button
          onClick={() => onPage(current_page + 1)}
          disabled={current_page >= last_page}
          aria-label="Next page"
          className="grid size-8 place-items-center rounded-md border border-line/60 transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
