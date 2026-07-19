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

/**
 * Page numbers around the current page, with the first and last always
 * reachable and gaps collapsed to an ellipsis:
 *
 *   1 … 4 [5] 6 … 20
 *
 * Returns a flat list so the caller renders numbers and gaps in one pass.
 */
function pageItems(current: number, last: number): Array<number | "gap"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const items: Array<number | "gap"> = [1];
  // Keep the window a constant width even at the ends, so the control doesn't
  // change size as you page through.
  const start = Math.max(2, Math.min(current - 1, last - 4));
  const end = Math.min(last - 1, Math.max(current + 1, 5));

  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < last - 1) items.push("gap");

  items.push(last);
  return items;
}

/** Pager with a "x–y of n" readout and jump-to-page numbers, driven by a
    Laravel paginator's meta block. */
export default function Pagination({
  meta,
  onPage,
}: {
  meta: PageMeta;
  onPage: (page: number) => void;
}) {
  const { current_page, last_page, total, from, to } = meta;
  if (total === 0) return null;

  const arrow =
    "grid size-8 place-items-center rounded-md border border-line/60 transition-colors hover:border-primary/60 hover:text-primary disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/60 bg-card px-4 py-3 text-xs text-muted-foreground">
      <span className="tabular-nums">
        {from ?? 0}–{to ?? 0} of {total}
      </span>

      {/* Wraps: up to seven page buttons plus both arrows is wider than a
          phone, and an un-wrapped row pushed the table sideways. */}
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <button
          onClick={() => onPage(current_page - 1)}
          disabled={current_page <= 1}
          aria-label="Previous page"
          className={arrow}
        >
          <ChevronLeft size={16} />
        </button>

        {pageItems(current_page, last_page).map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="px-1 select-none">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPage(item)}
              aria-label={`Page ${item}`}
              aria-current={item === current_page ? "page" : undefined}
              className={`grid size-8 place-items-center rounded-md border tabular-nums transition-colors ${
                item === current_page
                  ? "border-primary/60 bg-primary/10 font-semibold text-primary"
                  : "border-line/60 hover:border-primary/60 hover:text-primary"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          onClick={() => onPage(current_page + 1)}
          disabled={current_page >= last_page}
          aria-label="Next page"
          className={arrow}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
