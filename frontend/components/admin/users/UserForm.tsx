"use client";

/* Create / edit an administrator account. The same form backs both routes: with
   an `id` it loads and edits (password is changed separately via the list's
   "Reset password"), without one it creates (password required). Role and status
   for your own account are locked here — those changes have their own guarded
   paths — so you can't lock yourself out. */

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
  name: string;
  username: string;
  email: string;
  role: string;
  password: string;
  passwordConfirmation: string;
};

export default function UserForm({ id }: { id?: string }) {
  // Edit mode loads the account first; create mode renders immediately.
  const { data, loading, error } = useAdminResource<{ data: AdminUser }>(id ? `/users/${id}` : null);

  if (id) {
    if (loading && !data)
      return (
        <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      );
    if (error && !data) return <p className="py-20 text-sm text-red-400">{error}</p>;
    if (!data) return null;
    return <Form key={data.data.id} user={data.data} />;
  }

  return <Form />;
}

function Form({ user }: { user?: AdminUser }) {
  const router = useRouter();
  const { meta, notify } = useAdmin();
  const editing = !!user;

  const [form, setForm] = useState<FormState>(() => ({
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    role: user?.role ?? meta.roles[meta.roles.length - 1]?.value ?? "admin",
    password: "",
    passwordConfirmation: "",
  }));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  // You cannot change your own role from here (guarded server-side too).
  const roleLocked = editing && user!.isSelf;

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
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
        });
        notify("Account updated");
      } else {
        await apiSend("POST", "/users", {
          name: form.name,
          username: form.username,
          email: form.email,
          role: form.role,
          password: form.password,
          password_confirmation: form.passwordConfirmation,
        });
        notify("Administrator account created");
      }
      router.push("/admin/users");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={16} /> User Management
      </Link>
      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">
        {editing ? "Edit account" : "New administrator"}
      </h1>

      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-xl border border-line bg-card p-6">
          <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary">Account details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Full Name</label>
              <input className={inputCls} value={form.name} onChange={(e) => set({ name: e.target.value })} required maxLength={150} />
            </div>
            <div>
              <label className={labelCls}>Username</label>
              <input
                className={inputCls}
                value={form.username}
                onChange={(e) => set({ username: e.target.value })}
                required
                maxLength={50}
                autoComplete="off"
                placeholder="e.g. jsantos"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Letters, numbers, dashes and underscores.</p>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set({ email: e.target.value })} required maxLength={150} />
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => set({ role: e.target.value })} disabled={roleLocked}>
                {meta.roles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {roleLocked && <p className="mt-1.5 text-xs text-muted-foreground">You can’t change your own role.</p>}
            </div>
          </div>
        </section>

        {!editing && (
          <section className="rounded-xl border border-line bg-card p-6">
            <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary">Password</h2>
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

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-70">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {editing ? "Save changes" : "Create account"}
          </button>
          <Link href="/admin/users" className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:text-foreground">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
