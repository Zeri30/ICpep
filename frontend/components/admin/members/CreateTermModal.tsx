"use client";

/* Create a semester's membership list. The new list starts empty — existing
   records are never moved or copied — and only begins receiving applicants if
   it is made the current list. */

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, Loader2, X } from "lucide-react";
import { apiSend } from "@/lib/adminApi";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import type { MembershipTerm } from "@/lib/adminTypes";

const field =
  "w-full rounded-md border border-line bg-secondary/50 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/30";

export default function CreateTermModal({ onClose }: { onClose: () => void }) {
  const { notify } = useAdmin();
  const { current, terms, refreshTerms, selectTerm } = useTerms();

  // Default to the semester after the current list, which is what a rollover
  // almost always is — Sem 1 → Sem 2 of the same year, Sem 2 → Sem 1 of the next.
  const nextFrom = current ? (current.semester === 2 ? current.schoolYearFrom + 1 : current.schoolYearFrom) : new Date().getFullYear();
  const nextSemester = current ? (current.semester === 2 ? 1 : 2) : 1;

  const [from, setFrom] = useState(nextFrom);
  const [semester, setSemester] = useState(nextSemester);
  const [setCurrent, setSetCurrent] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Portal target only exists on the client; mount after hydration. Matches
  // ConfirmDialog and ResetPasswordModal so every dialog stacks the same way.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);

  // The cycle only moves forward, so anything before the current list is out of
  // bounds. Comparing year*10+semester orders the two cleanly. A semester that
  // already has a list is equally unusable, so both are surfaced the same way
  // rather than waiting for the server to reject the submit.
  const seq = (year: number, sem: number) => year * 10 + sem;
  const currentSeq = current ? seq(current.schoolYearFrom, current.semester) : null;
  const earliestYear = current ? current.schoolYearFrom : 2000;

  const isPast = (year: number, sem: number) => currentSeq !== null && seq(year, sem) < currentSeq;
  const alreadyExists = (year: number, sem: number) =>
    terms.some((t) => t.schoolYearFrom === year && t.semester === sem);

  const unavailable = (year: number, sem: number) => isPast(year, sem) || alreadyExists(year, sem);
  const reasonFor = (year: number, sem: number) =>
    isPast(year, sem) ? "Earlier than the current list" : alreadyExists(year, sem) ? "This list already exists" : null;

  const blocked = from < earliestYear || unavailable(from, semester);

  // Changing the year can invalidate the chosen semester; move to the other one
  // when it is usable, so the form settles on something valid by itself.
  const changeYear = (year: number) => {
    setFrom(year);
    if (unavailable(year, semester) && !unavailable(year, semester === 1 ? 2 : 1)) {
      setSemester(semester === 1 ? 2 : 1);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const term = await apiSend<MembershipTerm>("POST", "/terms", {
        schoolYearFrom: from,
        schoolYearTo: from + 1,
        semester,
        setCurrent,
      });

      await refreshTerms();
      selectTerm(term.id);
      notify(`Created ${term.label}`, {
        body: setCurrent ? "New applicants will be registered under this list." : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the membership list.");
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    // Scrolls rather than centring out of view: this form is the tallest
    // dialog in the admin and would otherwise clip on a short screen.
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 p-4">
      <div className="flex min-h-full items-center justify-center">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                <CalendarPlus size={20} />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold uppercase tracking-wide">New Membership List</h2>
                <p className="text-xs text-muted-foreground">A fresh roster for one semester.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>

          <div className="mt-6 space-y-5">
            {/* What the cycle is on now — the reference point for everything the
                form will and won't accept below. */}
            <div className="rounded-md border border-line bg-secondary/40 px-3.5 py-2.5">
              <p className="font-head text-[10px] uppercase tracking-widest text-muted-foreground">
                Current membership list
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {current ? current.label : "None yet"}
              </p>
              {current && (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  A new list must come after this one — the cycle cannot move backwards.
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground">
                School Year
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={earliestYear}
                  max={2100}
                  value={from}
                  onChange={(e) => changeYear(Number(e.target.value))}
                  className={field}
                  aria-label="School year from"
                  required
                />
                <span className="text-muted-foreground">–</span>
                {/* The second year always follows the first; showing it read-only
                    keeps the pair valid without an extra thing to get wrong. */}
                <input
                  type="number"
                  value={from + 1}
                  readOnly
                  tabIndex={-1}
                  className={`${field} cursor-not-allowed opacity-60`}
                  aria-label="School year to"
                />
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground">
                Semester
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((s) => {
                  const off = unavailable(from, s);
                  const reason = reasonFor(from, s);
                  return (
                    <label
                      key={s}
                      title={reason ?? undefined}
                      className={`flex flex-col items-center justify-center gap-0.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                        off
                          ? "cursor-not-allowed border-line/60 bg-secondary/20 text-muted-foreground opacity-60"
                          : semester === s
                            ? "cursor-pointer border-primary/60 bg-primary/10 text-primary"
                            : "cursor-pointer border-line bg-secondary/40 text-secondary-foreground hover:border-primary/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="semester"
                        className="sr-only"
                        disabled={off}
                        checked={semester === s}
                        onChange={() => setSemester(s)}
                      />
                      Semester {s}
                      {reason && <span className="text-[10px] leading-tight">{reason}</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {blocked && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {from < earliestYear
                  ? `The school year cannot start before ${earliestYear}.`
                  : (reasonFor(from, semester) ?? "Choose a later semester.")}
                {" "}Pick a semester after {current?.label}.
              </p>
            )}

            <label className="flex items-start gap-3 rounded-md border border-line bg-secondary/30 p-3">
              <input
                type="checkbox"
                checked={setCurrent}
                onChange={(e) => setSetCurrent(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">Set as the current list</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {setCurrent ? (
                    <>
                      New applicants will be registered here.
                      {current ? ` ${current.label} becomes a historical record.` : ""}
                    </>
                  ) : (
                    <>
                      The list is created but stays empty and inactive
                      {current ? `; applicants keep joining ${current.label}` : ""}. You can activate it later.
                    </>
                  )}
                </span>
              </span>
            </label>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-line px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest text-secondary-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || blocked}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-head font-semibold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Create List
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
