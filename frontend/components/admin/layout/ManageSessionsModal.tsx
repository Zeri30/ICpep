"use client";

/* Opened from AccountMenu's "Manage sessions" item. The backend has no
   endpoint to list an account's individual devices/browsers — only the two
   bulk actions below (MeController::logoutOtherSessions /
   logoutAllSessions) — so this stays a two-choice panel rather than a device
   list with per-row controls. */

import { AnimatePresence, motion } from "motion/react";
import { Laptop, LogOut, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ApiError, logoutAllSessions, logoutOtherSessions } from "@/lib/adminApi";

/** One of the two sign-out actions, styled as a self-explaining option card
    rather than a bare button — each states what it does and who it leaves
    signed in before the officer commits to it. */
function SessionAction({
  icon,
  title,
  description,
  buttonLabel,
  tone,
  busy,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  tone: "neutral" | "danger";
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${tone === "danger" ? "border-red-500/25 bg-red-500/4" : "border-line"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            tone === "danger" ? "bg-red-500/10 text-red-400" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors disabled:opacity-70 ${
          tone === "danger"
            ? "bg-red-600 text-white hover:bg-red-500"
            : "border border-line text-foreground hover:border-primary/50 hover:bg-secondary/50"
        }`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
        {buttonLabel}
      </button>
    </div>
  );
}

export default function ManageSessionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { officer, notify } = useAdmin();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  // "all" navigates away on success, so only "others" needs to clear itself.
  const [busy, setBusy] = useState<"others" | "all" | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  async function handleLogoutOthers() {
    setBusy("others");
    try {
      await logoutOtherSessions();
      notify("Other sessions signed out", {
        body: "Every other device is now signed out of this account.",
        tone: "success",
      });
      onClose();
    } catch (err) {
      notify("Couldn't sign out other sessions", {
        body: err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        tone: "warning",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleLogoutAll() {
    setBusy("all");
    try {
      // Navigates to the landing page on success — this device signs itself
      // out too, so there's no state left here to clear on the happy path.
      await logoutAllSessions();
    } catch (err) {
      notify("Couldn't sign out", {
        body: err instanceof ApiError ? err.message : "Something went wrong. Please try again.",
        tone: "warning",
      });
      setBusy(null);
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
            className="fixed inset-0 z-110 bg-black/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-120 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="sessions-modal-title"
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
                className="w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
              >
                <h2
                  id="sessions-modal-title"
                  className="font-display text-sm font-bold uppercase tracking-widest text-primary"
                >
                  Manage sessions
                </h2>

                <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-secondary/30 px-3.5 py-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold uppercase tracking-wide text-primary">
                    {officer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{officer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{officer.roleLabel ?? "Officer"}</div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground">
                  If you've signed in on a device you no longer recognize or no longer have, use one of the
                  options below to end that access.
                </p>

                <div className="mt-4 space-y-3">
                  <SessionAction
                    icon={<Laptop size={16} />}
                    title="Log out other sessions"
                    description="Signs this account out on every other device and browser. This device stays signed in."
                    buttonLabel="Log out other sessions"
                    tone="neutral"
                    busy={busy === "others"}
                    disabled={!!busy}
                    onClick={handleLogoutOthers}
                  />
                  <SessionAction
                    icon={<ShieldAlert size={16} />}
                    title="Log out all sessions"
                    description="Signs this account out everywhere, including this device — you'll need to sign in again."
                    buttonLabel="Log out all sessions"
                    tone="danger"
                    busy={busy === "all"}
                    disabled={!!busy}
                    onClick={handleLogoutAll}
                  />
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  disabled={!!busy}
                  className="mt-4 w-full rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
