"use client";

/* The membership-list controls at the top of the Members module: which
   semester's list you are looking at, and — for the roles that own the cycle —
   creating the next list and opening or closing the public form. */

import { useState } from "react";
import { CalendarPlus, History, Lock, LockOpen } from "lucide-react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import TermSelect from "@/components/admin/TermSelect";
import CreateTermModal from "@/components/admin/members/CreateTermModal";
import RegistrationModal from "@/components/admin/members/RegistrationModal";

export default function TermBar() {
  const { can } = useAdmin();
  const { isViewingPast, registration } = useTerms();
  const canManage = can("terms.manage");

  const [creating, setCreating] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<"close" | "open" | null>(null);

  const open = registration?.isOpen ?? true;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <TermSelect />

        <span className="hidden flex-1 sm:block" />

        {/* Side by side once there is room; stacked full-width on a phone,
            where two long uppercase labels otherwise wrap mid-word. */}
        {canManage && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setRegistrationMode(open ? "close" : "open")}
              className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-head font-semibold uppercase tracking-widest transition-colors ${
                open
                  ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                  : "border-green-500/40 text-green-400 hover:bg-green-500/10"
              }`}
            >
              {open ? <Lock size={14} /> : <LockOpen size={14} />}
              {open ? "Close Registration" : "Reopen Registration"}
            </button>

            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-head font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90"
            >
              <CalendarPlus size={14} />
              {/* The full label is only worth its width once there's room. */}
              <span className="sm:hidden">New List</span>
              <span className="hidden sm:inline">Create New Membership List</span>
            </button>
          </div>
        )}
      </div>

      {/* Viewing a past list is easy to forget you're doing — say so, since the
          row actions still work and would be edits to a historical record. */}
      {isViewingPast && (
        <p className="flex items-center gap-2 rounded-lg border border-line bg-secondary/40 px-3.5 py-2.5 text-sm text-secondary-foreground">
          <History size={15} className="shrink-0 text-muted-foreground" />
          You are viewing a past membership list. It no longer receives new registrations.
        </p>
      )}

      {/* Shown to every officer, not just those who can change it — anyone
          fielding "why can't I apply?" needs the answer visible. */}
      {!open && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-200">
          <Lock size={15} className="shrink-0" />
          <span className="font-medium">Membership registration is closed.</span>
          {registration?.reason && <span className="text-amber-200/80">Reason: {registration.reason}</span>}
        </p>
      )}

      {creating && <CreateTermModal onClose={() => setCreating(false)} />}
      {registrationMode && (
        <RegistrationModal mode={registrationMode} onClose={() => setRegistrationMode(null)} />
      )}
    </div>
  );
}
