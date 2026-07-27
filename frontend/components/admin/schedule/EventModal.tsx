"use client";

/* Create, edit, read and delete one calendar event.

   One modal covers all four because they are the same fields seen from
   different permissions: the Secretary gets a form, everyone else gets the same
   information laid out as text. Splitting them into a form modal and a details
   modal would mean two places to change whenever a field is added, and two
   chances for the read-only view to quietly fall behind.

   Laid out in two columns on anything wider than a phone. Stacked, the details,
   the status and the QR made a dialog taller than most screens, so the primary
   action sat below the fold and the whole thing scrolled as one — the fields
   are on the left, everything about the event's life on the right, and the
   header and footer stay put while only the middle scrolls. */

import { AnimatePresence, motion } from "motion/react";
import { CalendarPlus, Clock, Loader2, PencilLine, QrCode, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import AttendanceCredentials from "@/components/admin/schedule/AttendanceCredentials";
import CategoryTag from "@/components/admin/schedule/CategoryTag";
import {
  NeedsUpdateBadge,
  StatusBadge,
  TimingBadge,
} from "@/components/admin/schedule/StatusBadge";
import { apiSend } from "@/lib/adminApi";
import { formatLongDate } from "@/components/admin/schedule/calendarDates";
import type { ScheduledEvent } from "@/lib/adminTypes";

const fieldCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

const labelCls =
  "mb-1.5 block font-head text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground";

export default function EventModal({
  event,
  date,
  open,
  onSaved,
  onClose,
}: {
  /** The event being opened, or null when scheduling a new one. */
  event: ScheduledEvent | null;
  /** The day that was double-clicked — prefills the date when creating. */
  date: string | null;
  open: boolean;
  /**
   * Runs after a successful save or delete so the calendar can refetch. Given
   * the day that was written, so the grid can land on it — a new event that
   * appears in a month the officer is not looking at reads as a failure.
   */
  onSaved: (date?: string) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        // Keyed so opening a different event (or switching from an event to a
        // blank form) remounts with the right values rather than keeping the
        // previous one's.
        <EventDialog
          key={event ? `event-${event.id}` : `new-${date ?? "today"}`}
          event={event}
          date={date}
          onSaved={onSaved}
          onClose={onClose}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

function EventDialog({
  event,
  date,
  onSaved,
  onClose,
}: {
  event: ScheduledEvent | null;
  date: string | null;
  onSaved: (date?: string) => void;
  onClose: () => void;
}) {
  const { meta, can, notify } = useAdmin();
  const canManage = can("schedule.manage");
  // Everyone may open an event; only the Secretary sees fields they can change.
  const readOnly = !canManage;

  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.category ?? meta.eventCategories[0] ?? "");
  const [day, setDay] = useState(event?.date ?? date ?? "");
  const [time, setTime] = useState(event?.time ?? "17:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "19:00");
  const [description, setDescription] = useState(event?.description ?? "");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The event as it stands right now. Marking it done or minting a share link
  // both change it without closing the modal, and the officer should see the
  // consequence — a dead share button, a new link — immediately rather than
  // after reopening.
  const [current, setCurrent] = useState(event);
  const [statusSaving, setStatusSaving] = useState(false);

  async function setStatus(next: ScheduledEvent["status"]) {
    if (!current || next === current.status) return;
    setStatusSaving(true);
    setFormError(null);
    try {
      const updated = await apiSend<ScheduledEvent>(
        "PATCH",
        `/events/${current.id}/status`,
        { status: next },
      );
      setCurrent(updated);
      notify(`Marked ${updated.statusLabel.toLowerCase()}`, { body: updated.title });
      // Refresh the calendar behind, with no date so it does not jump.
      onSaved();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not update the status.");
    } finally {
      setStatusSaving(false);
    }
  }

  // Escape closes, unless a save is in flight — the request lands either way and
  // the officer would be left unsure whether it saved.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !confirmingDelete) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, confirmingDelete, onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;

    if (!title.trim()) return setFormError("Give the event a name.");
    if (!day) return setFormError("Choose a date.");
    if (!time) return setFormError("Choose a start time.");
    if (!endTime) return setFormError("Choose an end time.");
    // Checked here as well as on the server so the officer is told before the
    // round trip; both times are on the same day, so a plain string compare is
    // the whole rule.
    if (endTime <= time) return setFormError("The end time must be after the start time.");

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        title: title.trim(),
        category,
        date: day,
        // <input type="time"> can include seconds on some browsers; the API
        // takes H:i exactly.
        time: time.slice(0, 5),
        endTime: endTime.slice(0, 5),
        description: description.trim() || null,
      };

      if (current) {
        await apiSend("PATCH", `/events/${current.id}`, body);
        notify("Event updated", { body: title.trim() });
      } else {
        await apiSend("POST", "/events", body);
        notify("Event scheduled", { body: `${title.trim()} · ${formatLongDate(day)}` });
      }
      onSaved(day);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save the event.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!current) return;
    try {
      await apiSend("DELETE", `/events/${current.id}`);
      notify("Event removed", { body: current.title, tone: "success" });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not remove the event.");
    } finally {
      setConfirmingDelete(false);
    }
  }

  const heading = current ? (readOnly ? "Event details" : "Edit event") : "New event";
  const Icon = current ? PencilLine : CalendarPlus;
  // A new event has nothing in the right-hand column yet, so the dialog stays
  // narrow and single-column until there is something to put there.
  const twoColumn = !readOnly && current !== null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => !saving && onClose()}
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-[120] overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <motion.form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            // Capped at the viewport height with only the middle scrolling, so
            // Save is always reachable without hunting for it.
            className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)] ${
              twoColumn ? "max-w-3xl" : "max-w-lg"
            }`}
          >
            {/* ------------------------------------------------------ header */}
            <div className="flex items-start justify-between gap-4 border-b border-line/60 p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <h2
                    id="event-modal-title"
                    className="font-display text-xl font-black uppercase tracking-wide text-foreground"
                  >
                    {heading}
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {day ? formatLongDate(day) : "Pick a date below"}
                  </p>
                  {current && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <StatusBadge event={current} />
                      <TimingBadge event={current} />
                      {current.needsStatusUpdate && <NeedsUpdateBadge />}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Close"
                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* -------------------------------------------------------- body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              {readOnly && current ? (
                <ReadOnlyDetails event={current} />
              ) : (
                <div
                  className={
                    twoColumn ? "grid gap-6 sm:grid-cols-2 sm:gap-8" : "space-y-4"
                  }
                >
                  {/* --------------------------------------- the event itself */}
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls} htmlFor="event-title">Event name</label>
                      <input
                        id="event-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={150}
                        placeholder="e.g. General Assembly"
                        className={fieldCls}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className={labelCls} htmlFor="event-category">Category</label>
                      <select
                        id="event-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className={fieldCls}
                      >
                        {meta.eventCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelCls} htmlFor="event-date">Date</label>
                      <input
                        id="event-date"
                        type="date"
                        value={day}
                        onChange={(e) => setDay(e.target.value)}
                        className={fieldCls}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls} htmlFor="event-time">Starts</label>
                        <input
                          id="event-time"
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className={fieldCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="event-end-time">Ends</label>
                        <input
                          id="event-end-time"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className={fieldCls}
                        />
                      </div>
                    </div>

                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock size={12} /> Times are {meta.timezone.replace("_", " ")}, and an
                      event runs within one day.
                    </p>

                    <div>
                      <label className={labelCls} htmlFor="event-description">
                        Description / notes
                      </label>
                      <textarea
                        id="event-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={twoColumn ? 5 : 4}
                        maxLength={5000}
                        placeholder="What is it for, who should attend, anything to bring…"
                        className={`${fieldCls} resize-y`}
                      />
                    </div>
                  </div>

                  {/* ------------------------------- its status and its codes */}
                  {current ? (
                    <div className="space-y-4">
                      <StatusControl event={current} busy={statusSaving} onSet={setStatus} />
                      <AttendanceCredentials event={current} onShared={setCurrent} />
                    </div>
                  ) : (
                    // Nothing is generated while the form is open, so a new
                    // event has no credentials to show yet — say so rather than
                    // leave a gap the Secretary has to guess at.
                    <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-2.5 text-[11px] text-muted-foreground">
                      <QrCode size={13} /> A QR code and a 6-character attendance
                      code are generated once you save this event.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* ------------------------------------------------------ footer */}
            <div className="border-t border-line/60 p-5 sm:p-6">
              {formError && <p className="mb-3 text-sm text-red-400">{formError}</p>}

              <div className="flex flex-wrap items-center justify-end gap-3">
                {current && canManage && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={saving}
                    className="mr-auto inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-70"
                  >
                    <Trash2 size={15} /> Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
                >
                  {readOnly ? "Close" : "Cancel"}
                </button>
                {!readOnly && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70"
                  >
                    {saving && <Loader2 size={15} className="animate-spin" />}
                    {current ? "Save changes" : "Schedule event"}
                  </button>
                )}
              </div>
            </div>
          </motion.form>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Remove this event?"
        description={
          <>
            <span className="font-semibold text-foreground">{current?.title}</span> will be taken
            off the calendar for everyone.
          </>
        }
        confirmLabel="Remove"
        tone="danger"
        icon={<Trash2 size={20} className="text-red-400" />}
        onConfirm={remove}
        onClose={() => setConfirmingDelete(false)}
      />
    </>
  );
}

const STATUSES = [
  { value: "scheduled", label: "Scheduled", active: "bg-sky-500/15 text-sky-300" },
  { value: "done", label: "Done", active: "bg-green-500/15 text-green-400" },
  { value: "cancelled", label: "Cancelled", active: "bg-red-500/15 text-red-400" },
] as const satisfies ReadonlyArray<{
  value: ScheduledEvent["status"];
  label: string;
  active: string;
}>;

/**
 * Record what became of the event.
 *
 * Locked until the day has gone by: an outcome is an account of what happened,
 * and there is nothing to account for beforehand. Retracting one back to
 * Scheduled stays available whatever the date — otherwise an event closed and
 * then rescheduled could never be set right.
 *
 * Nagging is deliberate but bounded: a past event still marked Scheduled says
 * so plainly here, because that is the state nobody meant to leave it in.
 */
function StatusControl({
  event,
  busy,
  onSet,
}: {
  event: ScheduledEvent;
  busy: boolean;
  onSet: (status: ScheduledEvent["status"]) => void;
}) {
  const locked = !event.statusEditable;

  return (
    <div className="rounded-lg border border-line bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className={labelCls + " mb-0"}>Status</p>
        {busy && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>

      <div className="mt-2 flex rounded-lg border border-line p-0.5">
        {STATUSES.map((s) => {
          // Closing needs the day to have passed; retracting never does.
          const disabled = busy || (locked && s.value !== "scheduled");
          return (
            <button
              key={s.value}
              type="button"
              disabled={disabled}
              onClick={() => onSet(s.value)}
              aria-pressed={event.status === s.value}
              title={
                locked && s.value !== "scheduled"
                  ? "Available once the event's day has passed"
                  : undefined
              }
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                event.status === s.value ? s.active : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {locked
          ? `This event is ${event.timingLabel.toLowerCase()}. You can record whether it happened once its day has passed.`
          : event.needsStatusUpdate
            ? `This event was ${event.timingLabel.toLowerCase()} and is still marked scheduled. Say whether it happened.`
            : event.status === "scheduled"
              ? "Marking it done or cancelled revokes its share link for good."
              : "Its share link has been revoked. Setting it back to Scheduled lets you create a new one — the old link stays dead."}
      </p>
    </div>
  );
}

/** The same fields, for the roles whose calendar is view-only. */
function ReadOnlyDetails({ event }: { event: ScheduledEvent }) {
  return (
    <div className="space-y-4">
      <div>
        <p className={labelCls}>Event name</p>
        <p className="text-base font-semibold text-foreground">{event.title}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <CategoryTag category={event.category} />
        <span className="text-sm text-secondary-foreground">
          {formatLongDate(event.date)} · {event.timeRangeLabel}
        </span>
      </div>
      <div>
        <p className={labelCls}>Description / notes</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">
          {event.description || "—"}
        </p>
      </div>
      {event.createdBy && (
        <p className="text-[11px] text-muted-foreground">Scheduled by {event.createdBy}</p>
      )}
    </div>
  );
}
