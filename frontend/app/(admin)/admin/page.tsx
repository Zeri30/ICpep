"use client";

import { LayoutDashboard } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";

/* Batch 1 places the shell and auth guard. The live dashboard widgets (stats,
   payment summary, charts) land in Batch 2 — this confirms the shell renders
   and the officer/meta context resolved from /api/admin/me. */
export default function AdminDashboardPage() {
  const { officer, meta } = useAdmin();

  return (
    <div>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">
        Dashboard
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as {officer.name} · fee {meta.currency}
        {meta.fee.toFixed(0)}
      </p>

      <div className="mt-8 flex items-center gap-4 rounded-xl border border-dashed border-line bg-card/60 p-8 text-muted-foreground">
        <LayoutDashboard size={22} className="text-primary/70" />
        <p className="text-sm">
          Admin shell is live. Dashboard widgets and the Members, Payments, and Activity modules
          arrive in Batch&nbsp;2.
        </p>
      </div>
    </div>
  );
}
