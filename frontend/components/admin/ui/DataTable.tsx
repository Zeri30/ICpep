"use client";

/* Generic, styled table shell used by the Members / Payments / Activity lists.
   It renders header + rows + loading/empty/error states; each list supplies its
   own column definitions and row rendering. Sorting and pagination are owned by
   the caller (this only signals header clicks for sortable columns). */

import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";

export type Column<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
  className?: string;
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
}) {
  const alignClass = (a?: string) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line/70 bg-secondary/40">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground ${alignClass(col.align)}`}
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
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-line/40 transition-colors last:border-0 hover:bg-secondary/30"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 align-middle ${alignClass(col.align)} ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && (
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
  );
}
