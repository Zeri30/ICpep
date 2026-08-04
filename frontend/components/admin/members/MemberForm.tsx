"use client";

/* Edit a member.

   The state, validation and field markup live here and are shared by both
   presentations: the /members/[id]/edit route renders them as a page, and
   EditMemberModal renders the same fields in an overlay over the list. Only the
   chrome differs — one form implementation means the two cannot drift apart.
   Mirrors how UserForm backs both the account page and its modal.

   The Membership Fee block is only rendered for officers holding members.payment
   — the backend ignores a paid date from anyone else regardless, so showing the
   control would be a lie. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { Member } from "@/lib/adminTypes";

const inputCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60";
const labelCls = "mb-1.5 block font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground";

type FormState = {
  surname: string;
  givenName: string;
  middleInitial: string;
  studentId: string;
  yearLevel: string;
  section: string;
  birthday: string;
  address: string;
  email: string;
  phone: string;
  isPayment1Paid: boolean;
  payment1PaidAt: string; // datetime-local value
  isPayment2Paid: boolean;
  payment2PaidAt: string; // datetime-local value
};

/** Convert an ISO timestamp to the value a <input type="datetime-local"> wants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ------------------------------------------------------------------- state */

/**
 * Everything the form does, independent of how it is presented. `onDone` runs
 * after a successful save so the page can navigate and the modal can close and
 * refresh whatever is behind it.
 */
export function useMemberForm({ member, onDone }: { member: Member; onDone: () => void }) {
  const { meta, notify, can } = useAdmin();
  const canPay = can("members.payment");

  const [form, setForm] = useState<FormState>(() => ({
    surname: member.surname,
    givenName: member.givenName,
    middleInitial: member.middleInitial ?? "",
    studentId: member.studentId ?? "",
    yearLevel: member.yearLevel,
    section: member.section,
    birthday: member.birthday ?? "",
    address: member.address,
    email: member.email,
    phone: member.phone,
    isPayment1Paid: member.isPayment1Paid,
    payment1PaidAt: toLocalInput(member.payment1PaidAt),
    isPayment2Paid: member.isPayment2Paid,
    payment2PaidAt: toLocalInput(member.payment2PaidAt),
  }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      // The toggle owns paid state; keep the existing time when it was already
      // paid, else stamp now — mirroring the Filament form.
      const paidAt = form.isPayment1Paid
        ? (form.payment1PaidAt ? new Date(form.payment1PaidAt).toISOString() : new Date().toISOString())
        : null;
      const payment2PaidAt = form.isPayment2Paid
        ? (form.payment2PaidAt ? new Date(form.payment2PaidAt).toISOString() : new Date().toISOString())
        : null;
      await apiSend("PATCH", `/members/${member.id}`, {
        surname: form.surname,
        givenName: form.givenName,
        middleInitial: form.middleInitial || null,
        studentId: form.studentId,
        yearLevel: form.yearLevel,
        section: form.section,
        birthday: form.birthday,
        address: form.address,
        email: form.email,
        phone: form.phone,
        paidAt,
        payment2PaidAt,
      });
      notify("Member updated");
      onDone();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  }

  return { form, set, canPay, saving, formError, submit, meta };
}

export type MemberFormState = ReturnType<typeof useMemberForm>;

/* ------------------------------------------------------------------ fields */

/**
 * The inputs themselves. `boxed` gives each group the card treatment the page
 * layout wants; the modal is already a card, so it opts out rather than nesting
 * one inside another.
 */
export function MemberFields({ state, boxed = true }: { state: MemberFormState; boxed?: boolean }) {
  const { form, set, canPay, meta } = state;
  const section = boxed ? "rounded-xl border border-line bg-card p-6" : "";
  const heading = "mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary";

  return (
    <>
      <section className={section}>
        {/* In the overlay the dialog title already says "Edit member", so this
            heading would only repeat it — kept for screen readers. */}
        <h2 className={boxed ? heading : "sr-only"}>Member details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelCls}>Surname</label><input className={inputCls} value={form.surname} onChange={(e) => set({ surname: e.target.value })} required maxLength={100} /></div>
          <div><label className={labelCls}>Given Name</label><input className={inputCls} value={form.givenName} onChange={(e) => set({ givenName: e.target.value })} required maxLength={100} /></div>
          <div><label className={labelCls}>Middle Initial</label><input className={inputCls} value={form.middleInitial} onChange={(e) => set({ middleInitial: e.target.value })} maxLength={1} /></div>
          <div><label className={labelCls}>Student ID</label><input className={inputCls} value={form.studentId} onChange={(e) => set({ studentId: e.target.value.replace(/\D/g, "").slice(0, 10) })} required maxLength={10} pattern="\d{10}" inputMode="numeric" title="Exactly 10 digits, numbers only" /></div>
          <div>
            <label className={labelCls}>Year Level</label>
            <select className={inputCls} value={form.yearLevel} onChange={(e) => set({ yearLevel: e.target.value })}>
              {meta.yearLevels.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Section</label>
            <select className={inputCls} value={form.section} onChange={(e) => set({ section: e.target.value })}>
              {meta.sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Birthday</label><input type="date" className={inputCls} value={form.birthday} onChange={(e) => set({ birthday: e.target.value })} required /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Address</label><textarea className={inputCls} rows={2} value={form.address} onChange={(e) => set({ address: e.target.value })} required /></div>
          <div><label className={labelCls}>Email</label><input type="email" className={inputCls} value={form.email} onChange={(e) => set({ email: e.target.value })} required maxLength={150} /></div>
          <div><label className={labelCls}>Phone Number</label><input className={inputCls} value={form.phone} onChange={(e) => set({ phone: e.target.value })} required maxLength={30} /></div>
        </div>
      </section>

      {canPay && (
        // Unlike the details heading this one stays visible in the overlay: it
        // marks where personal data ends and a financial action begins.
        <section className={boxed ? section : "border-t border-line/60 pt-5"}>
          <h2 className={heading}>Membership Fee</h2>
          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isPayment1Paid}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    // Payment 2 can't stay marked paid once Payment 1 is
                    // unchecked — the same sequencing rule the backend
                    // enforces (see MemberController::update).
                    set(checked ? { isPayment1Paid: true } : { isPayment1Paid: false, isPayment2Paid: false });
                  }}
                  className="size-5 accent-primary"
                />
                <span className="text-sm text-foreground">
                  Payment 1 – Paid{" "}
                  <span className="text-muted-foreground">· adds {meta.currency}{meta.feePayment1.toFixed(0)} to revenue</span>
                </span>
              </label>
              {form.isPayment1Paid && (
                <div className="mt-3 max-w-xs">
                  <label className={labelCls}>Date paid</label>
                  <input
                    type="datetime-local"
                    className={inputCls}
                    value={form.payment1PaidAt}
                    onChange={(e) => set({ payment1PaidAt: e.target.value })}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">Back-date this if the fee was collected earlier.</p>
                </div>
              )}
            </div>

            <div className={form.isPayment1Paid ? "" : "opacity-50"}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.isPayment2Paid}
                  disabled={!form.isPayment1Paid}
                  onChange={(e) => set({ isPayment2Paid: e.target.checked })}
                  className="size-5 accent-primary disabled:cursor-not-allowed"
                />
                <span className="text-sm text-foreground">
                  Payment 2 – Paid{" "}
                  <span className="text-muted-foreground">· adds {meta.currency}{meta.feePayment2.toFixed(0)} to revenue</span>
                </span>
              </label>
              {!form.isPayment1Paid ? (
                <p className="mt-1.5 text-xs text-muted-foreground">Complete Payment 1 first.</p>
              ) : (
                form.isPayment2Paid && (
                  <div className="mt-3 max-w-xs">
                    <label className={labelCls}>Date paid</label>
                    <input
                      type="datetime-local"
                      className={inputCls}
                      value={form.payment2PaidAt}
                      onChange={(e) => set({ payment2PaidAt: e.target.value })}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">Back-date this if the fee was collected earlier.</p>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/* -------------------------------------------------------------- page layout */

/**
 * The /members/[id]/edit route. The list and the detail view open
 * EditMemberModal instead; this stays so a bookmarked or shared edit URL still
 * works.
 */
export default function MemberForm({ id }: { id: string }) {
  const { data, loading, error } = useAdminResource<{ data: Member }>(`/members/${id}`);
  const m = data?.data;

  if (loading && !m)
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  if (error && !m) return <p className="py-20 text-sm text-red-400">{error}</p>;
  if (!m) return null;

  // Remount and re-seed initial state if the loaded member changes.
  return <EditPage key={m.id} member={m} />;
}

function EditPage({ member }: { member: Member }) {
  const router = useRouter();
  const state = useMemberForm({ member, onDone: () => router.push("/admin/members") });

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={16} /> Members List
      </Link>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Edit member</h1>

      <form onSubmit={state.submit} className="space-y-6">
        <MemberFields state={state} />

        {state.formError && <p className="text-sm text-red-400">{state.formError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={state.saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70">
            {state.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
          </button>
          <Link href="/admin/members" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}