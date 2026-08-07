/* Shapes returned by the JSON admin API (see backend App\Http\Resources and the
   Api\Admin controllers). Kept in one place so the admin screens share them. */

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
    from: number | null;
    to: number | null;
  };
};

/** One semester's membership list. Exactly one is `isCurrent`. */
export type MembershipTerm = {
  id: number;
  schoolYearFrom: number;
  schoolYearTo: number;
  semester: number;
  /** "2026–2027 Semester 1" */
  label: string;
  isCurrent: boolean;
  memberCount?: number;
  createdAt: string | null;
};

/** Whether the public membership form is accepting submissions. */
export type RegistrationStatus = {
  isOpen: boolean;
  /** The officer-selected reason, shown to applicants while closed. */
  reason: string | null;
  closedAt: string | null;
  closedBy: string | null;
  presetReasons: string[];
  /** Where submissions land — the current list, not the newest one. */
  currentTerm: { id: number; label: string } | null;
};

export type Member = {
  id: number;
  surname: string;
  givenName: string;
  middleInitial: string | null;
  studentId: string | null;
  fullName: string;
  email: string;
  phone: string;
  yearLevel: string;
  section: string;
  classCode: string;
  birthday: string | null;
  address: string;
  /** Payment 1 (₱50) — must be paid before Payment 2 can be. */
  isPayment1Paid: boolean;
  payment1PaidAt: string | null;
  /** Payment 2 (₱25) — only payable once Payment 1 is. */
  isPayment2Paid: boolean;
  payment2PaidAt: string | null;
  createdAt: string | null;
  deletedAt: string | null;
  photoUrl: string | null;
  pictureUrl?: string | null;
  signatureUrl?: string | null;
};

/**
 * One event on the organization's calendar (see backend App\Models\Event).
 *
 * `date` and `time` arrive already converted to the organization's timezone, so
 * the grid groups on `date` as a plain string and the form fills straight from
 * both — no Date parsing, and therefore no chance of an event sliding a day
 * either way on a device whose clock is set elsewhere.
 */
export type ScheduledEvent = {
  id: number;
  title: string;
  category: string;
  /** Room, building or address — free text, and often unset. */
  venue: string | null;
  /** "2026-11-03" */
  date: string;
  /** "09:00" — for the start time input. */
  time: string;
  /** "11:00" — for the end time input. Null only on rows predating end times. */
  endTime: string | null;
  /** "9:00 AM" — for reading. */
  timeLabel: string;
  endTimeLabel: string | null;
  /** "9:00 AM – 11:00 AM". Falls back to the start alone when there is no end. */
  timeRangeLabel: string;
  /** The underlying instant, for comparing rather than displaying. */
  startsAt: string;
  description: string | null;

  /** What the secretariat says became of it. Never inferred from the date. */
  status: "scheduled" | "done" | "cancelled";
  statusLabel: string;
  /** Where it sits relative to today, worked out from the date each request. */
  timing: "upcoming" | "today" | "past";
  /** That, in words: "Today", "Tomorrow", "3 days ago". */
  timingLabel: string;
  /** It has finished and nobody has said whether it happened. */
  needsStatusUpdate: boolean;
  /**
   * Whether the outcome may be recorded yet — only from an hour after the
   * event ends. Read from the API rather than re-derived here: it turns on the
   * server's clock rather than the viewer's, and the control and the endpoint
   * can never disagree about whether a click will be accepted.
   */
  statusEditable: boolean;
  /**
   * Whether the QR and code are still valid. False once the day has passed or
   * the event is closed.
   */
  acceptsAttendance: boolean;

  /**
   * Where the signed-in officer stands with this event.
   *
   * Sent to every role, unlike the roster. The roster says who missed which
   * meeting and belongs to the secretariat; your own attendance is simply
   * yours — and an officer who scanned a QR has no other way to confirm it
   * landed, or to notice they were marked absent from something they attended.
   */
  myAttendance: {
    status: AttendanceStatus;
    /** "Present", "Absent", "Not checked in". */
    statusLabel: string;
    methodLabel: string | null;
    checkedInLabel: string | null;
    /** The codes are live and they are not on the record yet. */
    canCheckIn: boolean;
  };

  /**
   * The attendance credentials and share link, present only for officers who
   * can manage the schedule — the calendar itself is readable by everyone, and
   * the token is the whole secret behind a check-in, so the API withholds these
   * from the rest.
   */
  qrUrl?: string;
  attendanceCode?: string;
  /** Whether a link may be minted: still scheduled, and not yet past. */
  canShare?: boolean;
  shareUrl?: string | null;
  /**
   * A link was issued and has since been withdrawn. Distinguishes that from
   * never having been shared — both leave `shareUrl` null, but only this one
   * means creating a link now replaces a dead one rather than being the first.
   */
  shareRevoked?: boolean;
  /** Why sharing is off, when it is. */
  shareBlockedReason?: string | null;
  createdBy?: string | null;
  createdAt: string | null;
};

/* ------------------------------------------------------------- attendance */

/**
 * Where an officer stands with one event.
 *
 * Three readings, not two. `pending` is the absence of a record — nobody has
 * said either way — and it is a real state rather than a default to absent: an
 * event still hours away has nothing to say about anyone. It becomes `absent`
 * only when the event is marked done (see the backend's Event::recordAbsentees).
 */
export type AttendanceStatus = "present" | "absent" | "pending";

/** How a record came to be. Null on an absence written by the event closing. */
export type AttendanceMethod = "qr" | "code" | "override";

/** What the check-in page knows: the event, and the officer's own standing. */
export type CheckInState = {
  event: {
    id: number;
    title: string;
    category: string;
    venue: string | null;
    /** "Wednesday, 29 July 2026" */
    dateLabel: string;
    /** "9:00 AM – 11:00 AM" */
    timeRangeLabel: string;
    timingLabel: string;
  };
  /** Whether a check-in would be accepted right now. */
  accepted: boolean;
  /** Why it would not, when it would not — the backend's own words. */
  closedReason: string | null;
  status: AttendanceStatus;
  /** "7:02 PM", when there is a check-in to point at. */
  checkedInLabel: string | null;
  /**
   * Only on the response to a check-in: it had already been recorded, so
   * nothing just happened. Lets the page say "you were already checked in at
   * 7:02 PM" rather than claiming a scan that changed nothing.
   */
  alreadyCheckedIn?: boolean;
};

/** One line of the roster — an officer, and what the record says about them. */
export type RosterEntry = {
  userId: number;
  name: string;
  roleLabel: string | null;
  status: AttendanceStatus;
  /** "Present", "Absent", "Not checked in". */
  statusLabel: string;
  method: AttendanceMethod | null;
  methodLabel: string | null;
  checkedInAt: string | null;
  checkedInLabel: string | null;
  /** The officer who set this by hand, on the rows that were. */
  recordedBy: string | null;
};

export type EventRoster = {
  data: RosterEntry[];
  summary: { present: number; absent: number; pending: number; total: number };
  /**
   * Whether the QR and code are still live. Read from the API rather than
   * re-derived from the event on screen, so the panel and the endpoint can
   * never disagree about whether a check-in would be accepted.
   */
  acceptsAttendance: boolean;
  closedReason: string | null;
  /**
   * Has this event's own end time passed? Once true, the backend has already
   * recorded everyone still unaccounted for as absent and refuses any further
   * correction — see `attendanceLockedReason` for the sentence to show.
   */
  attendanceLocked: boolean;
  attendanceLockedReason: string | null;
};

export type PaymentRow = {
  id: number;
  memberName: string;
  section: string | null;
  yearLevel: string | null;
  action: "paid" | "revoked" | "adjusted";
  /** Which of the two sequential payment batches this row is for. */
  kind: "payment1" | "payment2";
  amount: number;
  effectiveAt: string | null;
  previousEffectiveAt: string | null;
  recordedAt: string | null;
  /** The officer's name, falling back to their email for account-less rows. */
  actorName: string | null;
  actor: string | null;
  actorRoleLabel: string | null;
  /** Which semester this event belongs to. Null only for rows written before
      terms existed. */
  paymentTerm: { isCurrent: boolean; shortLabel: string } | null;
};

export type AdminUser = {
  id: number;
  name: string;
  firstName: string | null;
  middleInitial: string | null;
  lastName: string | null;
  username: string | null;
  email: string;
  role: string | null;
  roleLabel: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  /** True on the signed-in officer's own row — used to disable self-actions. */
  isSelf: boolean;
  /** Set only while this account's reset-password cooldown is still running
      (see UserController::RESET_COOLDOWN_DAYS) — null once it's clear. */
  resetAvailableAt: string | null;
};

/* -------------------------------------------------------------- privileges */

/** One ability in the Privileges panel (see App\Enums\Permission::catalog). */
export type PermissionInfo = {
  value: string;
  label: string;
  description: string;
  /** The heading it sits under — "Members", "Finance", "Administration". */
  group: string;
  /**
   * Whether the panel may grant or revoke it. Abilities are opened up one at a
   * time; the rest are shown as fixed rows so the whole picture is visible.
   */
  editable: boolean;
  /**
   * An ability that must be held for this one to work, or null. Editing members
   * and changing payment both need `members.view`, since reaching the module at
   * all is gated on it — the backend drops them if it is missing.
   */
  requires: string | null;
};

/** What one role can do, and how far a change to it would reach. */
export type RolePrivileges = {
  value: string;
  label: string;
  /** The abilities the role holds right now. */
  permissions: string[];
  /** What it ships with — the target of "reset to defaults". */
  defaults: string[];
  /** True once the role has been changed from the shipped defaults. */
  customized: boolean;
  /** How many administrator accounts hold this role. */
  accountCount: number;
};

export type PrivilegesCatalog = {
  permissions: PermissionInfo[];
  roles: RolePrivileges[];
};

export type ActivityRow = {
  id: number;
  action: string;
  description: string;
  /** The officer's name, falling back to their email for account-less entries. */
  actorName: string | null;
  actor: string | null;
  actorRole: string | null;
  actorRoleLabel: string | null;
  applicant: string | null;
  createdAt: string | null;
};

export type SummaryCell = { members: number; amount: number; label: string };

export type DashboardData = {
  stats: {
    members: number;
    thirdYear: number;
    fourthYear: number;
    paid: number;
    unpaid: number;
    // Peso figures are null for roles without finance access.
    revenue: number | null;
    pendingRevenue: number | null;
  };
  // Null for non-finance roles.
  paymentSummary: { today: SummaryCell; week: SummaryCell; month: SummaryCell } | null;
  membersByClass: { labels: string[]; data: number[] };
  registrationsOverTime: { labels: string[]; data: number[] };
  /**
   * Whether this officer may see the chapter's money — the revenue tiles and
   * the payment summary. Separate from reaching Payment History: the
   * secretariat reads the ledger without being shown the takings.
   */
  canViewRevenue: boolean;
  /** The membership list these figures describe. */
  term: { id: number; label: string; isCurrent: boolean } | null;
};
