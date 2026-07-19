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
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Portal target only exists on the client; mount after hydration.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  async function handleConfirm() {
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
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={handleConfirm}
                    disabled={busy}
                    className={`inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors disabled:opacity-70 ${toneBtn[tone]}`}
                  >
                    {busy && <Loader2 size={15} className="animate-spin" />}
                    {confirmLabel}
                  </button>
                  <button
                    onClick={onClose}
                    disabled={busy}
                    className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
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
