"use client";

/* Who was at an event, and the secretariat's ability to put it right.

   The panel is built from the officer list rather than from the attendance
   records, because the question it answers is "who is missing" — and the
   officers who are missing have no record to render. That is why a third state
   exists alongside Present and Absent: nobody has said, which is honest for an
   event that has not happened yet and becomes Absent the moment it is closed.

   Correcting a status is a first-class action rather than a repair hatch. Real
   meetings have dead phones and people who arrive after the QR has been put
   away, and a roster that cannot be corrected is one that gets abandoned for a
   sheet of paper. Every correction is stamped and logged. */

import { AlertTriangle, Check, Loader2, Minus, RefreshCw, UserCheck, X } from "lucide-react";
import { useState } from "react";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { AttendanceStatus, EventRoster, RosterEntry, ScheduledEvent } from "@/lib/adminTypes";

/**
 * How often the roster refetches while the modal is open.
 *
 * Ten seconds, because the Secretary has this on screen while a queue of
 * officers scans at the door and the whole point is watching the names arrive.
 * Not a websocket: this is a dozen rows behind a session cookie, refetched only
 * while a modal is open, and the polling the rest of the admin already does
 * (see the sidebar's counts) is the pattern to match rather than to escape.
 */
const POLL_MS = 10000;

/** The three states a line can be in, and how each one wears. */
const TONES: Record<AttendanceStatus, { label: string; chip: string; dot: string }> = {
  present: {
    label: "Present",
    chip: "border-green-500/40 bg-green-500/10 text-green-400",
    dot: "bg-green-400",
  },
  absent: {
    label: "Absent",
    chip: "border-red-500/40 bg-red-500/10 text-red-400",
    dot: "bg-red-400",
  },
  pending: {
    label: "No answer",
    chip: "border-line bg-secondary/60 text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

/** The order the controls sit in, and the icon each one carries. */
const CHOICES = [
  { value: "present", label: "Present", Icon: Check },
  { value: "absent", label: "Absent", Icon: X },
  { value: "pending", label: "Clear", Icon: Minus },
] as const satisfies ReadonlyArray<{
  value: AttendanceStatus;
  label: string;
  Icon: typeof Check;
}>;

export default function AttendanceRoster({ event }: { event: ScheduledEvent }) {
  const { data, loading, error, refresh } = useAdminResource<EventRoster>(
    `/events/${event.id}/attendance`,
    { pollMs: POLL_MS },
  );

  // The officer currently being changed, so only their row shows a spinner
  // rather than the whole panel going quiet.
  const [saving, setSaving] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function setStatus(userId: number, status: AttendanceStatus) {
    setSaving(userId);
    setSaveError(null);
    try {
      // The endpoint answers with the whole roster, so one correction refreshes
      // the summary above without a second request — and without the panel
      // guessing at what the totals became.
      await apiSend<EventRoster>("PATCH", `/events/${event.id}/attendance/${userId}`, { status });
      await refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not change that.");
    } finally {
      setSaving(null);
    }
  }

  const summary = data?.summary;

  return (
    <div className="rounded-lg border border-line bg-secondary/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-head text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          <UserCheck size={13} /> Roster
        </p>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh the roster"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {loading && !data ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
      </div>

      {summary && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Tally label="Present" count={summary.present} tone="text-green-400" />
          <Tally label="Absent" count={summary.absent} tone="text-red-400" />
          <Tally label="No answer" count={summary.pending} tone="text-muted-foreground" />
        </div>
      )}

      {/* Said once, above the list, rather than on every row: the codes have
          stopped working, so anything from here on has to be set by hand. */}
      {data && !data.acceptsAttendance && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md border border-line bg-background/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-accent" />
          {data.closedReason ?? "This event is no longer taking check-ins."} Attendance can still be
          corrected here.
        </p>
      )}

      {error && <p className="mt-3 text-[11px] text-red-400">{error}</p>}
      {saveError && <p className="mt-3 text-[11px] text-red-400">{saveError}</p>}

      <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
        {loading && !data ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">Loading the roster…</p>
        ) : data?.data.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-muted-foreground">
            There are no active officer accounts to take attendance for.
          </p>
        ) : (
          data?.data.map((row) => (
            <RosterRow
              key={row.userId}
              row={row}
              busy={saving === row.userId}
              disabled={saving !== null}
              onSet={(status) => setStatus(row.userId, status)}
            />
          ))
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Officers check themselves in by scanning the QR or entering the code.
        Anything you change here is recorded as your correction.
      </p>
    </div>
  );
}

function Tally({ label, count, tone }: { label: string; count: number; tone: string }) {
  return (
    <div className="rounded-md border border-line bg-background/40 px-2 py-1.5 text-center">
      <p className={`font-display text-lg font-black leading-none tabular-nums ${tone}`}>{count}</p>
      <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

/**
 * One officer, their status, and the three buttons that set it.
 *
 * The controls are always offered, including for an event still in the future:
 * an officer who has told the Secretary in advance that they cannot make it is
 * a real thing to record, and the alternative is a panel that refuses to take
 * information it already has somewhere to put.
 */
function RosterRow({
  row,
  busy,
  disabled,
  onSet,
}: {
  row: RosterEntry;
  busy: boolean;
  /** Something else is saving — the whole panel waits, to keep the list stable. */
  disabled: boolean;
  onSet: (status: AttendanceStatus) => void;
}) {
  const tone = TONES[row.status];

  // What the row says under the name. The method matters most on the rows
  // somebody set by hand, which is exactly where "Present" alone would leave a
  // reader wondering who decided it.
  const detail =
    row.status === "present"
      ? [row.checkedInLabel, row.recordedBy ? `set by ${row.recordedBy}` : row.methodLabel]
          .filter(Boolean)
          .join(" · ")
      : row.recordedBy
        ? `set by ${row.recordedBy}`
        : null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-line/60 bg-background/40 px-2.5 py-2">
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">{row.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {row.roleLabel}
          {detail ? ` · ${detail}` : ""}
        </p>
      </div>

      {busy ? (
        <Loader2 size={13} className="shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <div
          role="group"
          aria-label={`Attendance for ${row.name}`}
          className="flex shrink-0 items-center gap-0.5"
        >
          {CHOICES.map(({ value, label, Icon }) => {
            const active = row.status === value;
            return (
              <button
                key={value}
                type="button"
                // Pressing the one already set would rewrite the row as a
                // correction of itself — a log line, a new timestamp, and no
                // change anyone made.
                disabled={disabled || active}
                onClick={() => onSet(value)}
                aria-pressed={active}
                title={`Mark ${row.name} ${label.toLowerCase()}`}
                className={`grid size-7 place-items-center rounded border transition-colors disabled:cursor-default ${
                  active
                    ? tone.chip
                    : "border-line text-muted-foreground hover:border-primary/50 hover:text-foreground disabled:opacity-40"
                }`}
              >
                <Icon size={13} strokeWidth={2.5} />
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
