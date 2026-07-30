"use client";

/* The list's quick-look at a member — opened from the eye icon in the row
   menu. Used to navigate to a full page (/admin/members/[id]) and back,
   which lost the officer's filters/page/scroll position on the way there and
   back; the overlay keeps them on the list throughout. Fetches its own copy
   of the record (list rows carry a thumbnail `photoUrl` but not the signed
   `pictureUrl`/`signatureUrl` the full profile needs). */

import { AnimatePresence, motion } from "motion/react";
import { Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import MemberProfileSections from "@/components/admin/members/MemberProfile";
import { useAdminResource } from "@/lib/adminApi";
import type { Member } from "@/lib/adminTypes";

export default function ViewMemberModal({
  memberId,
  onClose,
}: {
  /** The modal is open whenever this is non-null. */
  memberId: number | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {/* Keyed on the id so switching directly from one row's "View" to
          another's remounts the fetch for the new member. */}
      {memberId !== null && <ViewMemberDialog key={memberId} memberId={memberId} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function ViewMemberDialog({ memberId, onClose }: { memberId: number; onClose: () => void }) {
  const { data, loading, error } = useAdminResource<{ data: Member }>(`/members/${memberId}`);
  const m = data?.data;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      {/* Tall profiles must still be reachable on short screens, so the
          wrapper scrolls rather than centring the dialog out of view. */}
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-member-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="w-full max-w-lg rounded-xl border border-line bg-card p-5 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="view-member-title"
                className="font-display text-sm font-bold uppercase tracking-widest text-primary"
              >
                Member profile
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4">
              {loading && !m ? (
                <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : error && !m ? (
                <p className="py-10 text-sm text-red-400">{error}</p>
              ) : m ? (
                <MemberProfileSections member={m} variant="compact" />
              ) : null}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}
