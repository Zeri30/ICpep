"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

export type ToastTone = "success" | "info" | "warning";

export type Toast = {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
};

const toneStyle: Record<ToastTone, { icon: typeof CheckCircle2; accent: string }> = {
  success: { icon: CheckCircle2, accent: "#22c55e" },
  info: { icon: Info, accent: "#dc2626" },
  warning: { icon: AlertTriangle, accent: "#f59e0b" },
};

/** Bottom-right stack of transient notifications — the React admin's parity for
    Filament's action notifications. */
export default function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[min(92vw,22rem)] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, accent } = toneStyle[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              role="status"
              className="pointer-events-auto relative overflow-hidden rounded-lg border border-line bg-card px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
              <div className="flex items-start gap-3 pl-2">
                <Icon size={18} className="mt-0.5 shrink-0" style={{ color: accent }} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-xs text-muted-foreground">{t.body}</p>}
                </div>
                <button
                  onClick={() => onDismiss(t.id)}
                  aria-label="Dismiss"
                  className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
