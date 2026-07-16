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
  note: string | null;
};

export type ActivityRow = {
  id: number;
  action: string;
  description: string;
  actor: string | null;
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
    revenue: number;
    pendingRevenue: number;
  };
  paymentSummary: { today: SummaryCell; week: SummaryCell; month: SummaryCell };
  membersByClass: { labels: string[]; data: number[] };
  registrationsOverTime: { labels: string[]; data: number[] };
};
