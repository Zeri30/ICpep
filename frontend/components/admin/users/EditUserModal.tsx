"use client";

/* Edit an administrator account without leaving User Management. The overlay and
   chrome mirror NewUserModal; the fields and submit logic come from the shared
   UserForm (in `editing` mode, so there is no password section and the officer's
   own role stays locked). Editing used to navigate to a separate page — this
   keeps the officer on the list, matching how new accounts are created. */

import { AnimatePresence, motion } from "motion/react";
import { Loader2, PencilLine, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { AccountFields, useAccountForm } from "@/components/admin/users/UserForm";
import type { AdminUser } from "@/lib/adminTypes";

export default function EditUserModal({
  user,
  onSaved,
  onClose,
}: {
  /** The account to edit; the modal is open whenever this is non-null. */
  user: AdminUser | null;
  /** Runs after a successful save, so the list behind the modal can refresh. */
  onSaved: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {/* Keyed on the id so switching directly from one row to another remounts
          the form with the new account's values. */}
      {user && <EditUserDialog key={user.id} user={user} onSaved={onSaved} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function EditUserDialog({
  user,
  onSaved,
  onClose,
}: {
  user: AdminUser;
  onSaved: () => void;
  onClose: () => void;
}) {
  const state = useAccountForm({
    user,
    onDone: () => {
      onSaved();
      onClose();
    },
  });

  // Escape closes, unless a save is in flight — the request would land anyway
  // and the officer would be left unsure whether the edit was saved.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.saving, onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => !state.saving && onClose()}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      {/* Tall forms must still be reachable on short screens, so the wrapper
          scrolls rather than centring the dialog out of view. */}
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <motion.form
            onSubmit={state.submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-admin-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="w-full max-w-lg rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                  <PencilLine size={20} />
                </span>
                <div>
                  <h2
                    id="edit-admin-title"
                    className="font-display text-xl font-black uppercase tracking-wide text-foreground"
                  >
                    Edit account
                  </h2>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={state.saving}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <AccountFields state={state} boxed={false} />
            </div>

            {state.formError && <p className="mt-4 text-sm text-red-400">{state.formError}</p>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={state.saving}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state.saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70"
              >
                {state.saving && <Loader2 size={15} className="animate-spin" />} Save changes
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </>
  );
}
