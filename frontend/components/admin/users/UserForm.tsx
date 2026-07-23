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
import { ArrowLeft, Eye, EyeOff, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { AdminUser } from "@/lib/adminTypes";

const inputCls =
  "w-full rounded-md border border-line bg-secondary/60 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary/60 disabled:opacity-60";
const labelCls = "mb-1.5 block font-head text-[11px] font-semibold uppercase tracking-widest text-secondary-foreground";

type FormState = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  email: string;
  role: string;
  password: string;
  passwordConfirmation: string;
};

/* ------------------------------------------------------------------- state */

/**
 * Everything the form does, independent of how it is presented. `onDone` runs
 * after a successful save so the page can navigate and the modal can close and
 * refresh the list behind it.
 */
export function useAccountForm({ user, onDone }: { user?: AdminUser; onDone: () => void }) {
  const { meta, notify } = useAdmin();
  const editing = !!user;

  const [form, setForm] = useState<FormState>(() => ({
    firstName: user?.firstName ?? "",
    middleInitial: user?.middleInitial ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    role: user?.role ?? meta.roles[meta.roles.length - 1]?.value ?? "admin",
    password: "",
    passwordConfirmation: "",
  }));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!editing) {
      if (form.password.length < 8) return setFormError("Password must be at least 8 characters.");
      if (form.password !== form.passwordConfirmation) return setFormError("The passwords do not match.");
    }

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
      } else {
        await apiSend("POST", "/users", {
          first_name: form.firstName,
          middle_initial: form.middleInitial,
          last_name: form.lastName,
          email: form.email,
          role: form.role,
          password: form.password,
          password_confirmation: form.passwordConfirmation,
        });
        notify("Administrator account created");
      }
      onDone();
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
    showPassword,
    setShowPassword,
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
  const { form, set, editing, roleLocked, showPassword, setShowPassword, roles } = state;
  const section = boxed ? "rounded-xl border border-line bg-card p-6" : "";
  const heading = `mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary${boxed ? "" : " sr-only"}`;

  return (
    <>
      <section className={section}>
        <h2 className={heading}>Account details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>First Name</label>
            <input className={inputCls} value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} required maxLength={100} autoComplete="off" placeholder="Juan" />
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-4">
            <div>
              <label className={labelCls}>M.I.</label>
              <input
                className={inputCls}
                value={form.middleInitial}
                onChange={(e) => set({ middleInitial: e.target.value.slice(0, 1) })}
                maxLength={1}
                autoComplete="off"
                placeholder="S"
              />
            </div>
            <div>
              <label className={labelCls}>Last Name</label>
              <input className={inputCls} value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} required maxLength={100} autoComplete="off" placeholder="Dela Cruz" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Email</label>
            <input type="email" className={inputCls} value={form.email} onChange={(e) => set({ email: e.target.value })} required maxLength={150} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={form.role} onChange={(e) => set({ role: e.target.value })} disabled={roleLocked}>
              {roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {roleLocked && <p className="mt-1.5 text-xs text-muted-foreground">You can’t change your own role.</p>}
          </div>
        </div>
      </section>

      {!editing && (
        <section className={section}>
          <h2 className={heading}>Password</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${inputCls} pr-11`}
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>
            </div>
            <div>
              <label className={labelCls}>Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                className={inputCls}
                value={form.passwordConfirmation}
                onChange={(e) => set({ passwordConfirmation: e.target.value })}
                autoComplete="new-password"
                required
              />
            </div>
          </div>
        </section>
      )}
    </>
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
