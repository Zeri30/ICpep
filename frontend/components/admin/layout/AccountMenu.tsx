"use client";

/* The signed-in officer's name/role in the topbar, now a dropdown of account
   actions (Manage sessions, Logout) instead of plain text next to a separate
   sign-out button — see AdminTopbar. Sign-out reuses the same confirm dialog
   SignOutButton used. */

import { ChevronDown, LogOut, Monitor } from "lucide-react";
import { useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import ManageSessionsModal from "@/components/admin/layout/ManageSessionsModal";
import { signOut } from "@/lib/adminApi";
import { familyStyle, findRole } from "@/lib/roleFamily";
import { useOutsideClick } from "@/lib/useOutsideClick";

export default function AccountMenu() {
  const { officer, meta } = useAdmin();
  const [open, setOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const roleTint = familyStyle(findRole(meta.roles, officer.role)?.family).text;

  useOutsideClick(rootRef, () => setOpen(false), open, { closeOnEscape: true });

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-line hover:bg-secondary/40"
      >
        <div className="flex flex-col items-end leading-tight">
          <span
            className={`font-head text-[10px] font-semibold uppercase tracking-[0.2em] ${officer.roleLabel ? roleTint : "text-muted-foreground"}`}
          >
            {officer.roleLabel ?? "Welcome back"}
          </span>
          <span className="text-sm font-semibold text-foreground">{officer.name}</span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 overflow-hidden rounded-xl border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setSessionsOpen(true);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <Monitor size={16} /> Manage sessions
          </button>
          <div className="border-t border-line" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setSignOutOpen(true);
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      )}

      <ManageSessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={signOut}
        title="Sign out"
        description="You'll be returned to the sign-in page and will need your credentials to get back in."
        confirmLabel="Sign out"
        tone="danger"
        icon={<LogOut size={20} className="text-primary" />}
      />
    </div>
  );
}
