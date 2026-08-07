"use client";

/* Export the current filtered/searched list as CSV, Excel, or PDF — a small
   dropdown of links to a module's own /export/{csv,excel,pdf} endpoints
   (e.g. PaymentController::exportCsv). Generic over `base`, so any module
   with the same three routes can reuse it as-is; see Members List's own
   copy of this pattern for the export architecture this mirrors. */

import { ChevronDown, Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { useRef, useState } from "react";
import { useOutsideClick } from "@/lib/useOutsideClick";

export default function ExportMenu({ base, queryString }: { base: string; queryString: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => setOpen(false), open);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground";

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line bg-secondary/60 px-3.5 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:w-auto"
      >
        <Download size={16} /> Export
        <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-20 w-52 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)] sm:left-auto sm:right-0">
          <a href={`${base}/csv?${queryString}`} className={item} onClick={() => setOpen(false)}>
            <FileText size={15} /> Export as CSV
          </a>
          <a href={`${base}/excel?${queryString}`} className={item} onClick={() => setOpen(false)}>
            <FileSpreadsheet size={15} /> Export as Excel
          </a>
          <a href={`${base}/pdf?${queryString}`} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
            <FileType size={15} /> Export as PDF
          </a>
        </div>
      )}
    </div>
  );
}
