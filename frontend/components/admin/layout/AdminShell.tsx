"use client";

import { useState } from "react";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import AdminTopbar from "@/components/admin/layout/AdminTopbar";

/** The admin chrome: fixed sidebar on desktop, off-canvas on mobile, with the
    topbar and page content in the remaining column. */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />

      {/* Mobile scrim */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden
        />
      )}

      <div className="lg:pl-64">
        <AdminTopbar onMenu={() => setMenuOpen((v) => !v)} />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
