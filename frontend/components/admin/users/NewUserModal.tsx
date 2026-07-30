"use client";

/* Create an administrator account without leaving User Management. Portaled to
   the body so it paints above the admin chrome, matching ResetPasswordModal.

   The fields and submit logic come from UserForm — this file is only the
   overlay around them. The inner dialog owns its state and exists only while
   open, so each open starts clean with nothing to reset. */

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, KeyRound, Loader2, ShieldAlert, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { AccountFields, useAccountForm, type CreatedAccount } from "@/components/admin/users/UserForm";

export default function NewUserModal({
  open,
  onCreated,
  onClose,
}: {
  open: boolean;
  /** Runs after a successful create, so the list behind the modal can refresh. */
  onCreated: () => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && <NewUserDialog onCreated={onCreated} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function NewUserDialog({ onCreated, onClose }: { onCreated: () => void; onClose: () => void }) {
  // Set once the create request comes back — swaps the form for the one-time
  // credentials view. The account already exists at that point, so closing
  // the dialog from here is always safe, whatever `state.saving` still reads.
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const state = useAccountForm({
    onDone: (result) => {
      onCreated();
      if (result) setCreated(result);
      else onClose();
    },
  });

  const canClose = created !== null || !state.saving;

  // Escape closes, unless a save is in flight — the request would land anyway
  // and the officer would be left unsure whether the account was created.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => canClose && onClose()}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      {/* Tall forms must still be reachable on short screens, so the wrapper
          scrolls rather than centring the dialog out of view. */}
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-admin-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="w-full max-w-lg rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                  <UserPlus size={20} />
                </span>
                <div>
                  <h2
                    id="new-admin-title"
                    className="font-display text-xl font-black uppercase tracking-wide text-foreground"
                  >
                    {created ? "Account created" : "New administrator"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {created
                      ? "Share this password with them — it won't be shown again."
                      : "A first-login password is generated automatically; they'll be made to replace it before using the system."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={!canClose}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {created ? (
              <CredentialsPanel created={created} onDone={onClose} />
            ) : (
              <form onSubmit={state.submit}>
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
                    {state.saving && <Loader2 size={15} className="animate-spin" />} Create account
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

/** The one-time reveal: the generated password, shown once and copyable. */
function CredentialsPanel({ created, onDone }: { created: CreatedAccount; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(created.generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-lg border border-line bg-secondary/40 p-4">
        <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Email
        </p>
        <p className="mt-1 font-mono text-sm text-foreground">{created.email}</p>

        <p className="mt-4 font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          First-login password
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className="flex-1 truncate rounded-md border border-line bg-card px-3 py-2 font-mono text-sm text-foreground">
            {created.generatedPassword}
          </p>
          <button
            type="button"
            onClick={copy}
            className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            aria-label="Copy password"
          >
            {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-amber-accent/30 bg-amber-accent/10 px-3.5 py-2.5 text-xs text-amber-accent">
        <ShieldAlert size={15} className="mt-0.5 shrink-0" />
        <span>
          Shown once. They&apos;ll be required to set their own password the first time they sign in.
        </span>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent"
        >
          <KeyRound size={15} /> Done
        </button>
      </div>
    </div>
  );
}
