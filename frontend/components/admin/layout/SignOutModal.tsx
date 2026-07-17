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
        aria-label="Sign out"
        title="Sign out"
        className="grid size-10 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <LogOut size={16} />
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
