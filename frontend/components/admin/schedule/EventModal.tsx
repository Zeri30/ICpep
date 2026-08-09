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
   header and footer stay put while only the middle scrolls.

   The right column is itself a pair of tabs rather than three panels stacked:
   status and the QR/code on one, attendees on the other. The same reasoning
   as the columns applies one level down — three panels stacked there again
   made the dialog tall for no reason once there were two unrelated jobs
   ("what became of this event" and "who showed up") sharing one column. */

import { AnimatePresence, motion } from "motion/react";
import {
  CalendarPlus,
  Clock,
  Loader2,
  PencilLine,
  QrCode,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import CheckInModal from "@/components/attendance/CheckInModal";
import AttendanceCredentials from "@/components/admin/schedule/AttendanceCredentials";
import AttendanceRoster from "@/components/admin/schedule/AttendanceRoster";
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

/** The event's own details, as the form sends them — everything but its outcome. */
type EventFields = {
  title: string;
  category: string;
  venue: string | null;
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
    (fields.venue ?? "") !== (event.venue ?? "") ||
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
  const [venue, setVenue] = useState(event?.venue ?? "");
  const [day, setDay] = useState(event?.date ?? date ?? "");
  const [time, setTime] = useState(event?.time ?? "17:00");
  const [endTime, setEndTime] = useState(event?.endTime ?? "19:00");
  const [description, setDescription] = useState(event?.description ?? "");

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
        venue: venue.trim() || null,
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

  // The right column is set to exactly whatever height the left one actually
  // renders at — not a ceiling but the height, so a shorter tab is stretched
  // to line up with the bottom of the fields instead of leaving a gap, and a
  // taller one scrolls inside it instead of pushing the dialog down. Measured
  // rather than matched with a CSS-only equal-height trick, because the two
  // columns must NOT be free to stretch each other: the description box's
  // length decides the left column's height, and the right one only ever
  // follows it, never the other way round.
  //
  // Null below the `sm` breakpoint (matching the Tailwind prefix the grid
  // itself switches on at), where the columns stack instead of sitting side
  // by side and a height borrowed from the field column above would just cut
  // the tabs off for no reason.
  const leftColumnRef = useRef<HTMLDivElement>(null);
  const [rightHeight, setRightHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = leftColumnRef.current;
    if (!el || !twoColumn) return;

    const sideBySide = window.matchMedia("(min-width: 640px)");

    const measure = () => setRightHeight(sideBySide.matches ? el.offsetHeight : null);

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    sideBySide.addEventListener("change", measure);
    measure();

    return () => {
      observer.disconnect();
      sideBySide.removeEventListener("change", measure);
    };
  }, [twoColumn]);

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
      {/* Never scrolls as a whole, at any screen size — the dialog below is
          already capped at max-h-[calc(100dvh-2rem)], exactly matching this
          wrapper's own padding, and handles its own internal overflow (the
          form fields, the tabs) through the scrolling middle section it
          already has. This wrapper scrolling too was only ever a fallback
          for that arithmetic missing by a pixel on some browsers — which
          doesn't make the dialog visibly taller, it just leaves an empty
          scrollbar with nothing beyond the dialog's own edge worth scrolling
          to. `overflow-hidden` removes that outer scrollbar outright. */}
      <div className="fixed inset-0 z-[120] overflow-hidden p-4">
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
            // Save is always reachable without hunting for it. `overflow-hidden`
            // makes that cap a hard clip rather than a suggestion — without it,
            // anything inside that ends up a pixel taller than the cap (a
            // rounding difference, a height measured a render late) spills past
            // this box's own border into the page behind it, which is what
            // turns the whole viewport scrollable instead of just this dialog's
            // own middle section.
            className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-line bg-card shadow-[0_24px_70px_rgba(0,0,0,0.7)] ${
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
              {readOnly && current ? (
                <ReadOnlyDetails event={current} />
              ) : (
                <div
                  className={
                    // items-start, not the grid default of stretch: stretch
                    // would inflate the left column's own box to match the
                    // row height before it can be measured, which is exactly
                    // the height rightMaxHeight is measuring it for — a
                    // stretched box always measures as tall as whichever
                    // column is tallest, making the cap a no-op.
                    twoColumn ? "grid items-start gap-6 sm:grid-cols-2 sm:gap-8" : "space-y-4"
                  }
                >
                  {/* --------------------------------------- the event itself */}
                  <div ref={leftColumnRef} className="space-y-4">
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
                      <label className={labelCls} htmlFor="event-venue">Venue</label>
                      <input
                        id="event-venue"
                        value={venue}
                        onChange={(e) => setVenue(e.target.value)}
                        maxLength={150}
                        placeholder="e.g. Room 301, Meneses Building"
                        className={fieldCls}
                      />
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
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <label className={labelCls + " mb-0"} htmlFor="event-description">
                          Description / notes
                        </label>
                        {/* A live count rather than a silent cap — 5000 characters
                            is enough to type past comfortably, so the risk isn't
                            hitting the limit, it's not noticing a long description
                            has stopped growing readable and started scrolling. */}
                        <span
                          className={`shrink-0 text-[11px] tabular-nums ${
                            description.length >= 4500
                              ? "text-amber-accent"
                              : "text-muted-foreground"
                          }`}
                        >
                          {description.length}/5000
                        </span>
                      </div>
                      <textarea
                        id="event-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={twoColumn ? 9 : 5}
                        maxLength={5000}
                        placeholder="What is it for, who should attend, anything to bring…"
                        // Vertical drag-resize, not fixed rows: a short note stays
                        // compact, and a long one can be pulled taller instead of
                        // being read through a small scrolling window. `resize-y`
                        // still scrolls internally once dragged past its own
                        // content — this only changes how much fits before it has
                        // to. Bounded so it can't be shrunk to unusable or dragged
                        // taller than the dialog itself typically allows.
                        className={`${fieldCls} min-h-24 max-h-112 resize-y`}
                      />
                    </div>
                  </div>

                  {/* ------------------------------- its status and its codes */}
                  {current ? (
                    <EventSidePanel
                      event={current}
                      status={status}
                      busy={saving}
                      onSelect={setStatus}
                      onShared={setCurrent}
                      height={rightHeight}
                    />
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

/** The right column's two tabs, and the icon each carries. */
const SIDE_TABS = [
  { key: "status", label: "Status & QR", Icon: QrCode },
  { key: "attendees", label: "Attendees", Icon: Users },
] as const;

type SideTab = (typeof SIDE_TABS)[number]["key"];

/**
 * The event's status and codes on one tab, who showed up on the other.
 *
 * Both tabs stay mounted and only their visibility toggles, rather than one
 * unmounting the other — the attendee list polls while the modal is open (see
 * AttendanceRoster), and unmounting it every time the Secretary glanced at the
 * status tab would mean a fresh loading spinner on every switch back.
 */
function EventSidePanel({
  event,
  status,
  busy,
  onSelect,
  onShared,
  height,
}: {
  event: ScheduledEvent;
  status: ScheduledEvent["status"];
  busy: boolean;
  onSelect: (status: ScheduledEvent["status"]) => void;
  onShared: (updated: ScheduledEvent) => void;
  /** The left column's own rendered height — see EventDialog. Null on mobile. */
  height: number | null;
}) {
  const [tab, setTab] = useState<SideTab>("status");

  return (
    // An exact height, not a cap: a shorter tab is stretched to line up with
    // the bottom of the left column instead of leaving a gap under it, and a
    // taller one scrolls inside it instead of pushing the dialog down. Either
    // way the right side ends exactly where the left one does.
    <div
      // `min-w-0`: this is the grid item beside the fields column, and without
      // it a long, unbreakable value further inside (the share link — see
      // AttendanceCredentials) sets this column's own minimum width instead of
      // being clipped by its own `truncate`, pushing the whole dialog wider
      // than the screen on a phone.
      className="min-w-0 flex min-h-0 flex-col gap-4"
      style={height ? { height } : undefined}
    >
      <div
        role="tablist"
        aria-label="Event status and attendees"
        className="flex shrink-0 rounded-lg border border-line p-0.5"
      >
        {SIDE_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              tab === key
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* A flex column rather than the AttendanceRoster pattern of one card
          filling the tab: Status and Attendance are two separate cards, and
          Attendance is the one given `flex-1` — its own border grows to meet
          the bottom of the left column, instead of leaving blank space below
          a card that stopped at its natural size. */}
      <div
        className={
          tab === "status" ? "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto" : "hidden"
        }
      >
        <StatusControl event={event} value={status} busy={busy} onSelect={onSelect} />
        <AttendanceCredentials event={event} onShared={onShared} className="flex-1" />
      </div>

      <div className={tab === "attendees" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <AttendanceRoster event={event} />
      </div>
    </div>
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
    <div className="shrink-0 rounded-lg border border-line bg-secondary/30 p-3">
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
      {event.venue && (
        <div>
          <p className={labelCls}>Venue</p>
          <p className="text-sm text-secondary-foreground">{event.venue}</p>
        </div>
      )}
      <div>
        <p className={labelCls}>Description / notes</p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-secondary-foreground">
          {event.description || "—"}
        </p>
      </div>

      <MyAttendance event={event} />

      {event.createdBy && (
        <p className="text-[11px] text-muted-foreground">Scheduled by {event.createdBy}</p>
      )}
    </div>
  );
}

/**
 * Your own attendance at this event, and the way to record it if you still can.
 *
 * The counterpart to the roster, for the roles that do not get one. It answers
 * the two questions an officer actually has about a meeting — did my scan land,
 * and am I down as absent from something I was at — without showing them
 * anything about anybody else.
 *
 * Always rendered, `pending` included. Unlike the badge in the list, there is
 * room here to say "not checked in" and to explain that it is not the same
 * thing as absent.
 *
 * Not rendered at all for the Programming Team: that account runs the system
 * rather than holding a seat on the org chart, so it has no attendance to
 * report — see Event::recordAbsentees() and AttendanceController on the
 * backend, which keep it off the roster and the auto-absent sweep the same
 * way.
 */
function MyAttendance({ event }: { event: ScheduledEvent }) {
  const { officer } = useAdmin();
  const { status, statusLabel, methodLabel, checkedInLabel, canCheckIn } = event.myAttendance;
  const [checkInOpen, setCheckInOpen] = useState(false);

  if (officer.role === "programming_team") return null;

  // The check-in offer is only ever useful while the event is actually
  // happening today: not before it starts, not once its end time has passed,
  // and not on a past or future date — belt-and-suspenders alongside the
  // server's own `acceptsAttendance`/`canCheckIn` (which also closes it off
  // once the event is marked done, even mid-day). `event.date`/`endTime` are
  // already in the organization's timezone, so building a plain local Date
  // from them reads the same wall-clock time a person at the event would.
  const eventEndClock = event.endTime ?? event.time;
  const eventEndsAt = new Date(`${event.date}T${eventEndClock}:00`);
  const withinCheckInWindow = event.timing === "today" && new Date() <= eventEndsAt;

  const tone =
    status === "present"
      ? { chip: "border-green-500/40 bg-green-500/10 text-green-400", Icon: UserCheck }
      : status === "absent"
        ? { chip: "border-red-500/40 bg-red-500/10 text-red-400", Icon: UserX }
        : { chip: "border-line bg-secondary/60 text-muted-foreground", Icon: UserCheck };

  // What the panel says under the status. Each reading is a different question
  // the officer might be asking, answered in the words that fit that one.
  const explanation =
    status === "present"
      ? [checkedInLabel && `Recorded at ${checkedInLabel}`, methodLabel].filter(Boolean).join(" · ")
      : status === "absent"
        ? "You didn't attend this event. If that's wrong, ask the Secretary to correct it on the roster."
        : event.acceptsAttendance && withinCheckInWindow
          ? "Scan the event QR, or check in with the code."
          : "No attendance was recorded for you at this event.";

  return (
    <div className="rounded-lg border border-line bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={labelCls + " mb-0"}>Your attendance</p>
        <span className={`${pill} ${tone.chip}`}>
          <tone.Icon size={11} /> {statusLabel}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{explanation}</p>

      {canCheckIn && withinCheckInWindow && (
        // No token here — the QR token is withheld from every role but the
        // secretariat, and rightly so. The code path needs nothing but the six
        // characters read out at the event, so that is what this offers —
        // the same modal the topbar's QR button opens, just landed on
        // straight at the manual-code phase rather than the scanner.
        <button
          type="button"
          onClick={() => setCheckInOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors hover:bg-primary/10"
        >
          <UserCheck size={12} /> Check in with a code
        </button>
      )}

      <CheckInModal open={checkInOpen} initialMode="manual" onClose={() => setCheckInOpen(false)} />
    </div>
  );
}
