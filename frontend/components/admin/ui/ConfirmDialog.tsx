"use client";

/* Centered confirmation modal. Rendered at the document body via a portal so it
   always paints above the admin chrome (the same stacking lesson from the
   Filament sign-out modal). Reused by sign-out and every destructive action. */

import { AnimatePresence, motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";

export type ConfirmTone = "primary" | "danger" | "success";

const toneBtn: Record<ConfirmTone, string> = {
  primary: "bg-primary hover:bg-accent text-white",
  danger: "bg-red-600 hover:bg-red-500 text-white",
  success: "bg-green-600 hover:bg-green-500 text-white",
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  icon,
  /**
   * The exact (case-sensitive) word the officer must type before Confirm
   * does anything — the GitHub "type the repo name to delete it" pattern,
   * for actions too consequential for a click alone (see UsersList's "Log
   * out all admins").
   */
  typeToConfirm,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  icon?: React.ReactNode;
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  // Portal target only exists on the client; mount after hydration.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  // Fresh input every time the dialog opens, so a stale match from a
  // previous open can't slip a confirm through.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the typed-confirmation field per open, not derivable from render
  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const canConfirm = typeToConfirm === undefined || typed === typeToConfirm;

  async function handleConfirm() {
    if (!canConfirm) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => !busy && onClose()}
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
          />
          {/* Scrolls rather than centring out of view: a long description on a
              short screen (or a landscape phone) must not put the buttons
              somewhere unreachable. */}
          <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
                className="w-full max-w-sm rounded-xl border border-line bg-card p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
              >
                {icon && <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-secondary">{icon}</div>}
                <h2 className="font-display text-xl font-black uppercase tracking-wide text-foreground">
                  {title}
                </h2>
                {description && (
                  <div className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</div>
                )}
                {typeToConfirm !== undefined && (
                  <div className="mt-4">
                    <label className="mb-1.5 block text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Type <span className="font-mono normal-case text-foreground">{typeToConfirm}</span> to proceed
                    </label>
                    <input
                      autoFocus
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !busy && canConfirm && handleConfirm()}
                      placeholder={typeToConfirm}
                      disabled={busy}
                      className="w-full rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60 disabled:opacity-70"
                    />
                  </div>
                )}
                {/* Stacked full-width on narrow screens rather than a side-by-side
                    row: the confirm button's label shares space with a spinner
                    once `busy` is true, and a row too narrow to absorb that extra
                    width would otherwise wrap or squeeze mid-click, changing the
                    modal's layout right as it's being confirmed. */}
                <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <button
                    onClick={handleConfirm}
                    disabled={busy || !canConfirm}
                    // No whitespace-nowrap here: a short label ("Delete",
                    // "Confirm") never needed to wrap, but a longer one (a
                    // bulk payment action's "Mark Both Payments as Unpaid")
                    // forced onto one line by nowrap overflowed past the
                    // button and the dialog's edge instead of wrapping.
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-center text-sm font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto ${toneBtn[tone]}`}
                  >
                    {/* Fixed-width slot reserved regardless of `busy`, so the
                        label doesn't shift sideways the moment the spinner
                        appears. */}
                    <span className="grid w-3.75 shrink-0 place-items-center">
                      {busy && <Loader2 size={15} className="animate-spin" />}
                    </span>
                    <span>{confirmLabel}</span>
                  </button>
                  <button
                    onClick={onClose}
                    disabled={busy}
                    className="w-full whitespace-nowrap rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70 sm:w-auto"
                  >
                    {cancelLabel}
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
