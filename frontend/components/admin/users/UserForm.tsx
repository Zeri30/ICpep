"use client";

/* Create / edit an administrator account.

   The state, validation and field markup live here and are shared by both
   presentations: the edit route renders them as a page, and NewUserModal
   renders the same fields in an overlay. Only the chrome differs — one form
   implementation means the two cannot drift apart. Role and status for your own
   account are locked here — those changes have their own guarded paths — so you
   can't lock yourself out. */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import RoleOptions from "@/components/admin/users/RoleOptions";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { AdminUser } from "@/lib/adminTypes";

const inputCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60 disabled:opacity-60";
const labelCls = "mb-1.5 block font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground";

/**
 * "juan DELA cruz" → "Juan Dela Cruz" — regardless of how it was typed, so a
 * name pasted in from an all-caps ID or typed without the shift key still
 * reads the way it will everywhere else in the system (the activity log, the
 * roster, the generated password's own display name).
 */
function toTitleCase(value: string): string {
  return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

type FormState = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  email: string;
  role: string;
};

/** What a successful create hands back — the system-generated first-login
 *  password, shown once so it can be passed along to the new administrator. */
export type CreatedAccount = { email: string; generatedPassword: string };

/* ------------------------------------------------------------------- state */

/**
 * Everything the form does, independent of how it is presented. `onDone` runs
 * after a successful save so the page can navigate and the modal can close and
 * refresh the list behind it.
 */
export function useAccountForm({
  user,
  onDone,
}: {
  user?: AdminUser;
  /** Called with the generated credentials on create; with nothing on edit. */
  onDone: (created?: CreatedAccount) => void;
}) {
  const { meta, notify } = useAdmin();
  const editing = !!user;

  const [form, setForm] = useState<FormState>(() => ({
    firstName: user?.firstName ?? "",
    middleInitial: user?.middleInitial ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    // A new account starts on the least-privileged role, named by the backend.
    // This used to take the last option in the list, which was that role only
    // until the day a case was added after it — as the Team Heads were.
    role: user?.role ?? meta.defaultRole,
  }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        await apiSend("PATCH", `/users/${user!.id}`, {
          first_name: form.firstName,
          middle_initial: form.middleInitial,
          last_name: form.lastName,
          email: form.email,
          role: form.role,
        });
        notify("Account updated");
        onDone();
      } else {
        // The system generates the first-login password — see
        // UserController::store — and hands it back once so it can be shown
        // on screen; nothing here asks the admin to choose one.
        const created = await apiSend<{ generatedPassword: string }>("POST", "/users", {
          first_name: form.firstName,
          middle_initial: form.middleInitial,
          last_name: form.lastName,
          email: form.email,
          role: form.role,
        });
        notify("Administrator account created");
        onDone({ email: form.email, generatedPassword: created.generatedPassword });
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  }

  return {
    form,
    set,
    editing,
    // You cannot change your own role from here (guarded server-side too).
    roleLocked: editing && user!.isSelf,
    saving,
    formError,
    submit,
    roles: meta.roles,
  };
}

export type AccountFormState = ReturnType<typeof useAccountForm>;

/* ------------------------------------------------------------------ fields */

/**
 * The inputs themselves. `boxed` gives each group the card treatment the page
 * layout wants; the modal is already a card, so it opts out rather than
 * nesting one inside another.
 */
export function AccountFields({ state, boxed = true }: { state: AccountFormState; boxed?: boolean }) {
  const { form, set, roleLocked, roles } = state;
  const section = boxed ? "rounded-xl border border-line bg-card p-6" : "";
  const heading = `mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary${boxed ? "" : " sr-only"}`;

  return (
    <section className={section}>
      <h2 className={heading}>Account details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>First Name</label>
          <input className={inputCls} value={form.firstName} onChange={(e) => set({ firstName: toTitleCase(e.target.value) })} required maxLength={100} autoComplete="off" placeholder="Juan" />
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-4">
          <div>
            <label className={labelCls}>M.I.</label>
            <input
              className={inputCls}
              value={form.middleInitial}
              onChange={(e) => set({ middleInitial: e.target.value.slice(0, 2).toUpperCase() })}
              maxLength={2}
              autoComplete="off"
              placeholder="S"
            />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input className={inputCls} value={form.lastName} onChange={(e) => set({ lastName: toTitleCase(e.target.value) })} required maxLength={100} autoComplete="off" placeholder="Dela Cruz" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email</label>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set({ email: e.target.value })} required maxLength={150} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Role</label>
          <select className={inputCls} value={form.role} onChange={(e) => set({ role: e.target.value })} disabled={roleLocked}>
            <RoleOptions roles={roles} />
          </select>
          {roleLocked && <p className="mt-1.5 text-xs text-muted-foreground">You can’t change your own role.</p>}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- page layout */

/** The edit route. Creating an account is a modal — see NewUserModal. */
export default function UserForm({ id }: { id: string }) {
  const { data, loading, error } = useAdminResource<{ data: AdminUser }>(`/users/${id}`);

  if (loading && !data)
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  if (error && !data) return <p className="py-20 text-sm text-red-400">{error}</p>;
  if (!data) return null;

  return <EditPage key={data.data.id} user={data.data} />;
}

function EditPage({ user }: { user: AdminUser }) {
  const router = useRouter();
  const state = useAccountForm({ user, onDone: () => router.push("/admin/users") });

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={16} /> User Management
      </Link>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Edit account</h1>

      <form onSubmit={state.submit} className="space-y-6">
        <AccountFields state={state} />

        {state.formError && <p className="text-sm text-red-400">{state.formError}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={state.saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70">
            {state.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save changes
          </button>
          <Link href="/admin/users" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
