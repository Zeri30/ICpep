"use client";

/* Create, edit, read and delete one calendar event.

   One modal covers all four because they are the same fields seen from
   different permissions: the secretariat gets a form, everyone else gets the same
   information laid out as text. Splitting them into a form modal and a details
   modal would mean two places to change whenever a field is added, and two
   chances for the read-only view to quietly fall behind.

   Laid out in two columns on anything wider than a phone. Stacked, the details,
   the status and the QR made a dialog taller than most screens, so the primary
   action sat below the fold and the whole thing scrolled as one — the fields
   are on the left, everything about the event's life on the right, and the
   header and footer stay put while only the middle scrolls. */

import { AnimatePresence, motion } from "motion/react";
import {
  CalendarPlus,
  CircleQuestionMark,
  Clock,
  Loader2,
  PencilLine,
  QrCode,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import AttendanceCredentials from "@/components/admin/schedule/AttendanceCredentials";
import CategoryTag from "@/components/admin/schedule/CategoryTag";
import {
  NeedsUpdateBadge,
  STATUS_ORDER,
  STATUS_TONES,
  StatusBadge,
  TimingBadge,
  pill,
} from "@/components/admin/schedule/StatusBadge";
import { apiSend } from "@/lib/adminApi";
import { formatLongDate } from "@/components/admin/schedule/calendarDates";
import type { ScheduledEvent } from "@/lib/adminTypes";

const fieldCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60";

const labelText =
  "font-head text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground";

const labelCls = `mb-1.5 block ${labelText}`;

/** The same label as a row, so a hint icon can sit beside the words. */
const labelRowCls = `mb-1.5 flex items-center gap-1.5 ${labelText}`;

/**
 * Who an event's announcement goes out to.
 *
 * ⚠ Nothing is sent yet: this is not in the save payload and the API does not
 * accept it. The field is here so the shape of the decision is settled before
 * the mail goes out — an announcement that reaches the wrong list is not
 * something to discover after building the sending half. Both boxes are
 * independent and may be left unticked, which is what an event nobody is
 * emailed about looks like.
 */
const AUDIENCES = [
  { value: "officers", label: "Officers" },
  { value: "members", label: "Members" },
] as const;

type Audience = (typeof AUDIENCES)[number]["value"];

/**
 * The little (?) beside a label.
 *
 * Shown on hover *and* on focus, so the explanation is not pointer-only — the
 * icon is a real button for that reason, and `type="button"` so it cannot
 * submit the form it sits inside. The same words are its `aria-label`, which is
 * what a screen reader announces; the panel is the sighted half of one message
 * rather than a second one.
 *
 * Anchored to the icon's left edge and drawn downwards. Centred would put half
 * the panel past the left of the form, where the dialog's scroll container
 * would cut it off.
 */
function FieldHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="text-muted-foreground transition-colors hover:text-primary focus-visible:text-primary focus-visible:outline-none"
      >
        <CircleQuestionMark size={13} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-10 mt-1.5 w-52 rounded-lg border border-line bg-background px-2.5 py-2 text-[11px] font-normal normal-case leading-relaxed tracking-normal text-secondary-foreground opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** The event's own details, as the form sends them — everything but its outcome. */
type EventFields = {
  title: string;
  category: string;
  date: string;
  time: string;
  endTime: string;
  description: string | null;
};

/**
 * Has anything in the form moved away from the event as saved?
 *
 * Compared field by field against the same shapes the API returns, so an
 * untouched form is recognised as untouched. `endTime` is nullable on a row
 * saved before end times were recorded, and `description` is null rather than
 * empty when cleared — both normalise to "" so absent and blank are one thing.
 */
function edited(event: ScheduledEvent, fields: EventFields): boolean {
  return (
    fields.title !== event.title ||
    fields.category !== event.category ||
    fields.date !== event.date ||
    fields.time !== event.time ||
    fields.endTime !== (event.endTime ?? "") ||
    (fields.description ?? "") !== (event.description ?? "")
  );
}

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
  // Everyone may open an event; only the secretariat sees fields to change.
  const readOnly = !canManage;

  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.category ?? meta.eventCategories[0] ?? "");
  const [day, setDay] = useState(event?.date ?? date ?? "");
  const [time, setTime] = useState(event?.time ?? "17:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "19:00");
  const [description, setDescription] = useState(event?.description ?? "");

  // Starts empty on every open, since there is nowhere to have stored it yet.
  // See AUDIENCES — this is deliberately not part of the save.
  const [audience, setAudience] = useState<Audience[]>([]);

  const toggleAudience = (value: Audience) =>
    setAudience((current) =>
      current.includes(value) ? current.filter((a) => a !== value) : [...current, value],
    );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The event as the server last described it. Minting a share link changes it
  // without closing the modal — that is a request the officer made explicitly
  // and whose result they need in front of them to copy — so the panel below
  // is refreshed from the response rather than waiting for a reopen.
  const [current, setCurrent] = useState(event);

  // The outcome the form is holding, which is not the same thing as the one the
  // event has: like every other field here, it is chosen now and written on
  // Save. Clicking Done and then Cancel has to leave the event alone.
  const [status, setStatus] = useState<ScheduledEvent["status"]>(event?.status ?? "scheduled");

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
      const body: EventFields = {
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
        // Only sent when a detail actually moved. Recording an outcome is the
        // most common thing done to an existing event and usually touches
        // nothing else — sending the details anyway would write "Updated
        // General Assembly — now 3 Nov at 5:00 PM" into the activity log above
        // every single one, describing a change nobody made.
        const event = edited(current, body)
          ? await apiSend<ScheduledEvent>("PATCH", `/events/${current.id}`, body)
          : current;
        setCurrent(event);

        // Sent after the details, and only when it actually changed. Closing an
        // event is a separate act on a separate endpoint — it revokes the share
        // link, and it is refused for an event that is not over — so it goes
        // second, to be judged against the event as it will be rather than as
        // it was. Moving a meeting to next week and marking it done in the same
        // save is a contradiction, and this is the order that catches it.
        if (status !== event.status) {
          try {
            setCurrent(
              await apiSend<ScheduledEvent>("PATCH", `/events/${current.id}/status`, { status }),
            );
          } catch (err) {
            setFormError(err instanceof Error ? err.message : "Could not record the outcome.");
            // The details went through and only the outcome was refused. Leave
            // the modal open carrying the reason, but let the calendar catch up
            // — it would otherwise keep showing the old title until something
            // else refreshed it.
            onSaved();
            return;
          }
        }

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
                      {/* A group label rather than a <label>, since it names two
                          checkboxes rather than one control. */}
                      <span className={labelRowCls} id="event-attendees-label">
                        Attendees
                        <FieldHint text="Who gets an email announcement about this event." />
                      </span>
                      <div
                        role="group"
                        aria-labelledby="event-attendees-label"
                        className="grid grid-cols-2 gap-2"
                      >
                        {AUDIENCES.map((a) => {
                          const checked = audience.includes(a.value);
                          return (
                            <label
                              key={a.value}
                              className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                                checked
                                  ? "border-primary/50 bg-primary/10 text-foreground"
                                  : "border-line bg-secondary/40 text-secondary-foreground hover:border-primary/30"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleAudience(a.value)}
                                className="size-4 accent-primary"
                              />
                              {a.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

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
                      <StatusControl
                        event={current}
                        value={status}
                        busy={saving}
                        onSelect={setStatus}
                      />
                      <AttendanceCredentials event={current} onShared={setCurrent} />
                    </div>
                  ) : (
                    // Nothing is generated while the form is open, so a new
                    // event has no credentials to show yet — say so rather than
                    // leave a gap the scheduler has to guess at.
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

/**
 * Choose what became of the event.
 *
 * A field like any other: picking one stages it, and Save changes writes it.
 * Applying it on the click would make this the one control in the dialog that
 * cannot be taken back by pressing Cancel — and the thing it does is not small,
 * since closing an event revokes its share link for good.
 *
 * Locked until an hour after the event ends: an outcome is an account of what
 * happened, and there is nothing to account for beforehand. Retracting one back
 * to Scheduled stays available whatever the date — otherwise an event closed
 * and then rescheduled could never be set right.
 *
 * Nagging is deliberate but bounded: a past event still marked Scheduled says
 * so plainly here, because that is the state nobody meant to leave it in.
 */
function StatusControl({
  event,
  value,
  busy,
  onSelect,
}: {
  /** The event as saved — what the rules and the standing hint are read from. */
  event: ScheduledEvent;
  /** The outcome the form is holding, which may not be the saved one yet. */
  value: ScheduledEvent["status"];
  busy: boolean;
  onSelect: (status: ScheduledEvent["status"]) => void;
}) {
  const locked = !event.statusEditable;
  const pending = value !== event.status;

  // Six readings of the same control, flat rather than nested five ternaries
  // deep, so which one applies is a line you can point at.
  function hint(): string {
    // While a choice is pending the hint describes what saving will do — the
    // consequence belongs with the decision, not after it.
    if (pending && value === "scheduled") {
      return "Saving puts this back to Scheduled. The old share link stays dead; you can create a new one afterwards.";
    }
    if (pending) {
      return `Saving records this as ${STATUS_TONES[value].label.toLowerCase()} and revokes its share link for good.`;
    }
    if (locked) {
      return `This event is ${event.timingLabel.toLowerCase()}. You can record whether it happened from an hour after it ends.`;
    }
    if (event.needsStatusUpdate) {
      return `This event was ${event.timingLabel.toLowerCase()} and is still marked scheduled. Say whether it happened.`;
    }
    if (event.status === "scheduled") {
      return "Marking it done or cancelled revokes its share link for good.";
    }
    return "Its share link has been revoked. Setting it back to Scheduled lets you create a new one — the old link stays dead.";
  }

  return (
    <div className="rounded-lg border border-line bg-secondary/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className={labelCls + " mb-0"}>Status</p>
        {busy ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : (
          // Says plainly that the event has not changed yet. Without it the
          // control looks exactly as it did when clicking was the whole action.
          pending && (
            <span className={`${pill} border-amber-accent/40 bg-amber-accent/10 text-amber-accent`}>
              Unsaved
            </span>
          )
        )}
      </div>

      <div className="mt-2 flex rounded-lg border border-line p-0.5">
        {STATUS_ORDER.map((option) => {
          // Closing needs the event to be over; retracting never does.
          const disabled = busy || (locked && option !== "scheduled");
          const { label, active } = STATUS_TONES[option];
          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(option)}
              aria-pressed={value === option}
              title={
                locked && option !== "scheduled"
                  ? "Available an hour after the event ends"
                  : undefined
              }
              className={`flex-1 rounded-md px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                value === option ? active : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{hint()}</p>
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
