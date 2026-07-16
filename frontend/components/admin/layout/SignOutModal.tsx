"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { signOut } from "@/lib/adminApi";

/** Sign-out button + confirmation. On confirm, the session is cleared and the
    officer is returned to the public landing page (parity with the old admin). */
export default function SignOutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-2 font-head text-xs font-semibold uppercase tracking-widest text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <LogOut size={14} /> Sign out
      </button>

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
