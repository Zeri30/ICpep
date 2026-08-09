"use client";

/* Generic, styled table shell used by the Members / Payments / Activity lists.
   It renders header + rows + loading/empty/error states; each list supplies its
   own column definitions and row rendering. Sorting and pagination are owned by
   the caller (this only signals header clicks for sortable columns). */

import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";

export type Column<T> = {
  key: string;
  /** Node rather than text so a column can put a control in its header — the
      members list hangs its select-all checkbox off the selection column. */
  header: React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  className?: string;
  /**
   * Column width, only honoured when the table opts into `fixedLayout`. Under
   * the default auto layout, columns' widths depend on their content and the
   * browser can hand narrow columns uneven leftover space — two short columns
   * next to each other can end up looking tighter than a padding class alone
   * would suggest. A fixed layout with explicit widths (e.g. percentages
   * summing to 100%) makes gaps between columns depend only on padding.
   */
  width?: string;
  /**
   * The placeholder shown in this cell while the first page is loading, if the
   * list opts into skeletons by passing `skeletonRows`.
   *
   * Declared per column because only the column knows what its cell looks like:
   * a generic bar under the Photo header would be a rectangle where a round
   * avatar is about to land, which is the layout shift the skeleton exists to
   * avoid. Columns that leave it out get a plain bar, which is right for the
   * text ones.
   */
  skeleton?: React.ReactNode;
};

export type SortState = { key: string; direction: "asc" | "desc" } | null;

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyHeading = "Nothing here yet",
  emptyDescription,
  sort,
  onSort,
  fill = false,
  footer,
  skeletonRows = 0,
  fixedLayout = false,
  rowDividerClassName = "border-line/40",
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: string | null;
  emptyHeading?: string;
  emptyDescription?: string;
  sort?: SortState;
  onSort?: (key: string) => void;
  /**
   * How many placeholder rows to draw instead of the spinner while `loading`.
   * Zero (the default) keeps the spinner, so a list opts in by passing a count
   * and no existing caller changes behaviour.
   *
   * The count should be the page size the API is about to return: the skeleton
   * then occupies exactly the height and scroll extent the real rows will, and
   * nothing moves when they arrive. That is the point of the whole exercise —
   * a spinner leaves a collapsed table that jumps to full height, and column
   * widths that snap from header-sized to content-sized.
   */
  skeletonRows?: number;
  /**
   * Consume the height the parent gives it and scroll the rows internally,
   * instead of growing the page. The header stays pinned and `footer` stays
   * visible, so paging controls never scroll out of reach. The parent must
   * have a definite height for this to do anything.
   */
  fill?: boolean;
  /** Pinned below the rows, inside the card — pagination lives here. */
  footer?: React.ReactNode;
  /**
   * Give each column's `width` the final say instead of letting the browser
   * size columns off their content. Off by default so existing tables render
   * exactly as before; a list opts in once it's supplying `width` on every
   * column.
   */
  fixedLayout?: boolean;
  /** Row divider color/weight, e.g. "border-line" for a more visible split
      between rows. Defaults to the subtle divider every other table uses. */
  rowDividerClassName?: string;
}) {
  const alignClass = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  // `table-fixed` pins each column to its declared width, but a cell's own
  // overflow stays visible by default — `white-space: nowrap` content longer
  // than that width paints past the cell edge and over whatever column comes
  // next, rather than being clipped by it. `overflow-hidden` makes the
  // fixed width the actual boundary, matching what the percentages already
  // implied. Auto-layout tables don't opt in: there the browser is sizing
  // columns off their content in the first place, so nothing overflows.
  const cellClass = (col: Column<T>) =>
    `px-4 py-3 align-middle ${alignClass(col.align)} ${fixedLayout ? "overflow-hidden" : ""} ${col.className ?? ""}`;

  // Placeholder rows replace the spinner rather than joining it — two loading
  // indicators for one fetch is one too many.
  const showSkeleton = Boolean(loading) && skeletonRows > 0;

  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-card ${
        fill ? "flex min-h-0 flex-1 flex-col" : ""
      }`}
    >
      {/* min-h-0 lets this shrink below its content inside a flex column, which
          is what makes the overflow scroll rather than pushing the page down. */}
      <div className={`overflow-x-auto ${fill ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        <table
          className={`w-full min-w-[40rem] border-collapse text-sm ${fixedLayout ? "table-fixed" : ""}`}
          aria-busy={showSkeleton || undefined}
        >
          {fixedLayout && (
            <colgroup>
              {columns.map((col) => (
                <col key={col.key} style={col.width ? { width: col.width } : undefined} />
              ))}
            </colgroup>
          )}
          <thead className={fill ? "sticky top-0 z-10" : ""}>
            <tr className="border-b border-line/70 bg-secondary/40 backdrop-blur">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ${alignClass(col.align)} ${col.className ?? ""}`}
                  >
                    {col.sortable && onSort ? (
                      <button
                        onClick={() => onSort(col.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${active ? "text-primary" : ""}`}
                      >
                        {col.header}
                        {active &&
                          (sort!.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          {/* Hidden from assistive tech: the placeholders carry no information,
              and a screen reader announcing twenty empty rows is worse than the
              spinner's one honest "Loading…" — which the status below keeps. */}
          <tbody aria-hidden={showSkeleton || undefined}>
            {showSkeleton
              ? Array.from({ length: skeletonRows }, (_, i) => (
                  <tr key={`skeleton-${i}`} className={`border-b ${rowDividerClassName} last:border-0`}>
                    {columns.map((col) => (
                      <td key={col.key} className={cellClass(col)}>
                        {/* inline-block, so a bar in a right-aligned column
                            sits where that column's content will. */}
                        {col.skeleton ?? <span className="skeleton inline-block h-4 w-24 rounded" />}
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={`border-b ${rowDividerClassName} transition-colors last:border-0 hover:bg-secondary/30`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cellClass(col)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>

        {showSkeleton && (
          <span role="status" className="sr-only">
            Loading…
          </span>
        )}
        {loading && !showSkeleton && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        )}
        {!loading && error && (
          <div className="py-12 text-center text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="py-14 text-center">
            <p className="font-display text-lg font-bold uppercase tracking-wide text-foreground">{emptyHeading}</p>
            {emptyDescription && <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>}
          </div>
        )}
      </div>

      {footer}
    </div>
  );
}
