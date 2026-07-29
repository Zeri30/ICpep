"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { signOut } from "@/lib/adminApi";

/**
 * Sign-out button + confirmation. On confirm, the session is cleared and the
 * officer is returned to the public landing page (parity with the old admin).
 *
 * Two variants sharing the one confirmation: `icon` is the compact circular
 * button the topbar shows from `sm` up, and `row` is a full-width nav-style
 * row for the mobile drawer, where the topbar has no room left for it (see
 * AdminTopbar and AdminSidebar).
 */
export default function SignOutButton({ variant = "icon" }: { variant?: "icon" | "row" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Sign out"
          title="Sign out"
          className="grid size-10 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <LogOut size={16} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          <LogOut size={18} />
          <span className="flex-1 text-left font-head text-xs uppercase tracking-wide">Sign out</span>
        </button>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={signOut}
        title="Sign out"
        description="You'll be returned to the sign-in page and will need your credentials to get back in."
        confirmLabel="Sign out"
        tone="danger"
        icon={<LogOut size={20} className="text-primary" />}
      />
    </>
  );
}
