"use client";

/* Opened from AccountMenu's "Manage sessions" item. The two buttons are real
   (MeController::logoutOtherSessions / logoutAllSessions), but there is still
   no endpoint to list an account's actual active sessions, so the devices
   below stay placeholders shaped like what that endpoint will eventually
   return. */

import { AnimatePresence, motion } from "motion/react";
import { Laptop, Loader2, LogOut, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ApiError, logoutAllSessions, logoutOtherSessions } from "@/lib/adminApi";

const PLACEHOLDER_SESSIONS = [
  {
    id: 1,
    device: "This device",
    detail: "Chrome on Windows",
    location: "Manila, Philippines",
    lastActive: "Active now",
    current: true,
  },
  {
    id: 2,
    device: "iPhone",
    detail: "Safari on iOS",
    location: "Quezon City, Philippines",
    lastActive: "2 hours ago",
    current: false,
  },
] as const;

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
            className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
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
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id="sessions-modal-title"
                    className="font-display text-sm font-bold uppercase tracking-widest text-primary"
                  >
                    Manage sessions
                  </h2>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={!!busy}
                    aria-label="Close"
                    className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-lg border border-line bg-secondary/30 px-3.5 py-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold uppercase tracking-wide text-primary">
                    {officer.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{officer.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{officer.roleLabel ?? "Officer"}</div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  These are the devices currently signed in to this account. If you don&apos;t recognize one,
                  log it out below for security.
                </p>

                <div className="mt-4 space-y-2">
                  {PLACEHOLDER_SESSIONS.map((s) => {
                    const Icon = s.detail.includes("iOS") || s.detail.includes("Android") ? Smartphone : Laptop;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-foreground">{s.device}</span>
                            {s.current && (
                              <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                This device
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {s.detail} · {s.location}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-muted-foreground">{s.lastActive}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={handleLogoutOthers}
                    disabled={!!busy}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-primary/50 hover:bg-secondary/50 disabled:opacity-70"
                  >
                    {busy === "others" ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Log out other sessions
                  </button>
                  <button
                    type="button"
                    onClick={handleLogoutAll}
                    disabled={!!busy}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-red-500 disabled:opacity-70"
                  >
                    {busy === "all" ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                    Log out all sessions
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
