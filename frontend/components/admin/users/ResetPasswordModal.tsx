"use client";

/* Password-reset dialog for an administrator account. Portaled to the body so it
   paints above the admin chrome, matching ConfirmDialog. Validates a minimum
   length and a matching confirmation client-side before the request; the backend
   re-validates regardless.

   The inner dialog owns the field state and only exists while open, so each open
   starts clean with no state to reset (the same pattern as SignInModal). */

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";

const inputCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";
const labelCls = "mb-1.5 block font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground";

export default function ResetPasswordModal({
  open,
  userName,
  onSubmit,
  onClose,
}: {
  open: boolean;
  userName: string | null;
  /** Resolve to submit; reject/throw to keep the dialog open and show the error. */
  onSubmit: (password: string, confirmation: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && <ResetDialog userName={userName} onSubmit={onSubmit} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function ResetDialog({
  userName,
  onSubmit,
  onClose,
}: {
  userName: string | null;
  onSubmit: (password: string, confirmation: string) => Promise<void>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirmation) return setError("The passwords do not match.");
    setError(null);
    setBusy(true);
    try {
      await onSubmit(password, confirmation);
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
        onClick={() => !busy && onClose()}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      {/* Scrolls rather than centring out of view, so the buttons stay
          reachable on a short screen. */}
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
        <motion.form
          onSubmit={handleSubmit}
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.3, ease: easeOutExpo }}
          className="w-full max-w-sm rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary text-primary">
            <KeyRound size={20} />
          </div>
          <h2 className="text-center font-display text-xl font-black uppercase tracking-wide text-foreground">
            Reset password
          </h2>
          {userName && (
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Set a new password for <span className="text-foreground">{userName}</span>.
            </p>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label className={labelCls}>New password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputCls} pr-11`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Confirm password</label>
              <input
                type={show ? "text" : "password"}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="submit"
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
        </motion.form>
        </div>
      </div>
    </>
  );
}
