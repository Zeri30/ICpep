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
  fullName: string;
  email: string;
  phone: string;
  yearLevel: string;
  section: string;
  classCode: string;
  birthday: string | null;
  address: string;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string | null;
  deletedAt: string | null;
  photoUrl: string | null;
  pictureUrl?: string | null;
  signatureUrl?: string | null;
};

export type PaymentRow = {
  id: number;
  memberName: string;
  section: string | null;
  action: "paid" | "revoked" | "adjusted";
  amount: number;
  effectiveAt: string | null;
  previousEffectiveAt: string | null;
  recordedAt: string | null;
  actor: string | null;
};

export type AdminUser = {
  id: number;
  name: string;
  username: string | null;
  email: string;
  role: string | null;
  roleLabel: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  /** True on the signed-in officer's own row — used to disable self-actions. */
  isSelf: boolean;
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
  canViewFinance: boolean;
  /** The membership list these figures describe. */
  term: { id: number; label: string; isCurrent: boolean } | null;
};
