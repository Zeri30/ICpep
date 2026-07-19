"use client";

/* Closing and reopening the public membership form.

   Closing runs in two steps — pick a reason, then confirm — because the reason
   is shown verbatim to every applicant who reaches the landing page, and the
   effect (nobody can apply) is invisible from inside the admin. The confirm
   step echoes the exact wording that will appear publicly. */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Loader2, LockOpen, X } from "lucide-react";
import { apiSend } from "@/lib/adminApi";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import type { RegistrationStatus } from "@/lib/adminTypes";

const CUSTOM = "__custom__";

export default function RegistrationModal({
  mode,
  onClose,
}: {
  mode: "close" | "open";
  onClose: () => void;
}) {
  const { notify } = useAdmin();
  const { registration, current, refreshRegistration } = useTerms();

  const presets = registration?.presetReasons ?? [];
  const [choice, setChoice] = useState<string>(presets[0] ?? CUSTOM);
  const [custom, setCustom] = useState("");
  const [confirming, setConfirming] = useState(mode === "open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portal target only exists on the client; mount after hydration. Matches
  // ConfirmDialog and ResetPasswordModal so every dialog stacks the same way.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  const reason = choice === CUSTOM ? custom.trim() : choice;
  const canProceed = mode === "open" || reason.length > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      if (mode === "close") {
        await apiSend<RegistrationStatus>("POST", "/registration/close", { reason });
        notify("Membership registration closed", { body: `Reason: ${reason}`, tone: "warning" });
      } else {
        await apiSend<RegistrationStatus>("POST", "/registration/open");
        notify("Membership registration reopened", {
          body: current ? `New applicants join ${current.label}.` : undefined,
        });
      }
      await refreshRegistration();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update registration.");
      setSaving(false);
    }
  };

  const danger = mode === "close";

  if (!mounted) return null;

  return createPortal(
    // Scrolls rather than centring out of view, so a tall dialog stays
    // usable on a short screen.
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 p-4">
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-full ${
                  danger ? "bg-amber-500/15 text-amber-400" : "bg-green-500/15 text-green-400"
                }`}
              >
                {danger ? <AlertTriangle size={20} /> : <LockOpen size={20} />}
              </span>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide">
                {danger ? "Close Registration" : "Reopen Registration"}
              </h2>
            </div>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <div className="mt-6">
            {/* Step 1 — choose the reason applicants will see. */}
            {danger && !confirming && (
              <fieldset>
                <legend className="mb-3 font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground">
                  Reason for closing <span className="text-primary">*</span>
                </legend>

                <div className="space-y-2">
                  {[...presets, CUSTOM].map((option) => (
                    <label
                      key={option}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                        choice === option
                          ? "border-primary/60 bg-primary/10 text-foreground"
                          : "border-line bg-secondary/40 text-secondary-foreground hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="reason"
                        className="accent-primary"
                        checked={choice === option}
                        onChange={() => setChoice(option)}
                      />
                      {option === CUSTOM ? "Other reason…" : option}
                    </label>
                  ))}
                </div>

                {choice === CUSTOM && (
                  <input
                    autoFocus
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. Awaiting adviser approval"
                    className="mt-3 w-full rounded-md border border-line bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
                  />
                )}
              </fieldset>
            )}

            {/* Step 2 — the consequence, in the words applicants will read. */}
            {danger && confirming && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-secondary-foreground">
                  Are you sure you want to close the Membership Registration Form? Users will no longer be able
                  to submit membership applications until registration is reopened.
                </p>
                <div className="rounded-md border border-line bg-secondary/40 px-3 py-2.5">
                  <p className="font-head text-[10px] uppercase tracking-widest text-muted-foreground">
                    Reason shown to applicants
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{reason}</p>
                </div>
              </div>
            )}

            {!danger && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-secondary-foreground">
                  The membership form will start accepting applications again.
                </p>
                <div className="rounded-md border border-line bg-secondary/40 px-3 py-2.5">
                  <p className="font-head text-[10px] uppercase tracking-widest text-muted-foreground">
                    New applicants will be registered under
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {current?.label ?? "No active list — create one first"}
                  </p>
                </div>
              </div>
            )}

            {error && (
              <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            {danger && confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft size={13} /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-line px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              disabled={!canProceed || saving || (!danger && !current)}
              onClick={() => (danger && !confirming ? setConfirming(true) : submit())}
              className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                danger ? "bg-amber-600" : "bg-green-600"
              }`}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {danger ? (confirming ? "Confirm" : "Continue") : "Reopen Registration"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
