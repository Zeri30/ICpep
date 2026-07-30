"use client";

/* Password-reset dialog for an administrator account.

   Resetting no longer means typing a new password in on the account's
   behalf: it puts the account back in the same first-login state a newly
   created one starts in — a fresh system-generated password (see
   UserController::resetPassword) and forced to set a real one at next
   sign-in — same as NewUserModal's one-time reveal. Everything else on the
   account is untouched.

   Portaled to the body so it paints above the admin chrome, matching
   ConfirmDialog. The inner dialog owns its state and only exists while open,
   so each open starts clean with nothing to reset. */

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";

export default function ResetPasswordModal({
  open,
  userName,
  onConfirm,
  onClose,
}: {
  open: boolean;
  userName: string | null;
  /** Performs the reset and resolves with the new first-login password. */
  onConfirm: () => Promise<string>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && <ResetDialog userName={userName} onConfirm={onConfirm} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function ResetDialog({
  userName,
  onConfirm,
  onClose,
}: {
  userName: string | null;
  onConfirm: () => Promise<string>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the reset lands — swaps the confirmation for the one-time
  // credentials view. The password is already changed at that point, so
  // closing from here is always safe, whatever `busy` still reads.
  const [generated, setGenerated] = useState<string | null>(null);

  const canClose = generated !== null || !busy;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && canClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setGenerated(await onConfirm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
      setBusy(false);
    }
  }

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
      {/* Scrolls rather than centring out of view, so the buttons stay
          reachable on a short screen. */}
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-password-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
          >
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary text-primary">
              <KeyRound size={20} />
            </div>
            <h2
              id="reset-password-title"
              className="text-center font-display text-xl font-black uppercase tracking-wide text-foreground"
            >
              {generated ? "Password reset" : "Reset password"}
            </h2>
            {userName && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {generated ? (
                  <>
                    Share this password with <span className="text-foreground">{userName}</span> —
                    it won&apos;t be shown again.
                  </>
                ) : (
                  <>
                    A new first-login password will be generated for{" "}
                    <span className="text-foreground">{userName}</span>. Everything else on the
                    account stays as it is.
                  </>
                )}
              </p>
            )}

            {generated ? (
              <GeneratedPasswordPanel password={generated} onDone={onClose} />
            ) : (
              <>
                <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-accent/30 bg-amber-accent/10 px-3.5 py-2.5 text-xs text-amber-accent">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Their current password stops working immediately, and they&apos;ll be required
                    to set a new one the next time they sign in.
                  </span>
                </div>

                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70"
                  >
                    {busy && <Loader2 size={15} className="animate-spin" />} Reset password
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
}

/** The one-time reveal: the generated password, shown once and copyable. */
function GeneratedPasswordPanel({ password, onDone }: { password: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused on an insecure origin. The password is
      // on screen either way, so there is nothing to recover from.
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-lg border border-line bg-secondary/40 p-4">
        <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          First-login password
        </p>
        <div className="mt-1 flex items-center gap-2">
          <p className="flex-1 truncate rounded-md border border-line bg-card px-3 py-2 font-mono text-sm text-foreground">
            {password}
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

      <div className="flex justify-center">
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
