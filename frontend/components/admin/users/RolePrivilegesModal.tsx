"use client";

/* Privileges — opened from a row's 3-dots menu in User Management.

   The row is only the entry point: what gets edited is that account's *role*,
   so a change reaches every account holding it. The panel says so plainly, and
   names the number of accounts affected, because "I ticked a box on Maria's row"
   and "every President can now mark members paid" have to feel like the same
   act.

   Scope is deliberately narrow for now — paid/unpaid is the only ability that
   moves. The rest are drawn as fixed rows rather than hidden, so the officer can
   see what a role holds without having to trust that the panel shows everything.
   Backed by App\Http\Controllers\Api\Admin\RolePermissionController. */

import { AnimatePresence, motion } from "motion/react";
import { Info, Loader2, Lock, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { easeOutExpo } from "@/components/ui/motion-primitives";
import { useAdmin } from "@/components/admin/AdminProvider";
import RoleBadge from "@/components/admin/users/RoleBadge";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { AdminUser, PermissionInfo, PrivilegesCatalog, RolePrivileges } from "@/lib/adminTypes";

export default function RolePrivilegesModal({
  user,
  onClose,
}: {
  /** The account whose row was used; the modal is open whenever this is non-null. */
  user: AdminUser | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount guard for the portal
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {/* Keyed on the role so opening a different one remounts with its own
          ticks rather than showing the previous role's. */}
      {user?.role && <PrivilegesDialog key={user.role} user={user} onClose={onClose} />}
    </AnimatePresence>,
    document.body,
  );
}

function PrivilegesDialog({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { officer, notify } = useAdmin();
  const { data, loading, error, refresh } = useAdminResource<PrivilegesCatalog>("/users/roles");

  const role: RolePrivileges | undefined = data?.roles.find((r) => r.value === user.role);

  // The ticks being edited. Seeded from the server once the fetch lands, and
  // left alone afterwards so a refresh can't discard work in progress.
  const [checked, setChecked] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seeding the form from the fetched role
    if (role) setChecked((c) => c ?? role.permissions);
  }, [role]);

  // Memoized so the identity is stable while nothing has been ticked yet — the
  // comparisons below depend on it.
  const current = useMemo(() => checked ?? role?.permissions ?? [], [checked, role]);

  // Only the editable rows can differ, so this is exactly "is there anything to
  // save" — it drives the Save button and the unsaved-changes warning.
  const dirty = useMemo(() => {
    if (!role || !data) return false;
    return data.permissions.some(
      (p) => p.editable && current.includes(p.value) !== role.permissions.includes(p.value),
    );
  }, [role, data, current]);

  // Editing the role you hold yourself: the admin shell reads your abilities
  // once at load, so the change is live on the API but the sidebar and buttons
  // around you won't catch up until a reload.
  const editingOwnRole = officer.role === user.role;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onClose]);

  /**
   * Tick or untick an ability, keeping the set coherent: unticking one takes its
   * dependants with it, since the backend would drop them anyway and leaving
   * them ticked would promise access the API refuses.
   */
  function toggle(value: string) {
    setChecked((c) => {
      const base = c ?? role?.permissions ?? [];
      if (!base.includes(value)) return [...base, value];

      const dependants = (data?.permissions ?? [])
        .filter((p) => p.requires === value)
        .map((p) => p.value);

      return base.filter((v) => v !== value && !dependants.includes(v));
    });
  }

  async function save() {
    if (!role) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiSend<RolePrivileges>("PUT", `/users/roles/${role.value}`, {
        permissions: current,
      });
      setChecked(updated.permissions);
      await refresh();
      notify(`Privileges updated for ${role.label}`, {
        body:
          updated.accountCount === 1
            ? "Applies to the 1 account with this role."
            : `Applies to all ${updated.accountCount} accounts with this role.`,
      });
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save the privileges.");
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!role) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await apiSend<RolePrivileges>("POST", `/users/roles/${role.value}/reset`);
      setChecked(updated.permissions);
      await refresh();
      notify(`${role.label} is back on its default privileges`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not reset the privileges.");
    } finally {
      setSaving(false);
    }
  }

  /* Looked up when resolving prerequisites, so a row can name the ability it
     depends on rather than just its raw value. */
  const byValue = useMemo(
    () => new Map((data?.permissions ?? []).map((p) => [p.value, p])),
    [data],
  );

  /* The footer note only makes sense while something is still off-limits, and
     it names the tickable abilities from the catalog rather than hard-coding
     them — so it can't claim the panel is narrower than it is. With everything
     grantable there is nothing to caveat, and the note disappears. */
  const fixedNote = useMemo(() => {
    const all = data?.permissions ?? [];
    const editable = all.filter((p) => p.editable);
    if (all.length === 0 || editable.length === all.length) return null;

    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(
      editable.map((p) => p.label.toLowerCase()),
    );
  }, [data]);

  /* Grouped in declaration order, so "Members" reads before "Administration"
     and the payment row sits with the other member abilities. */
  const groups = useMemo(() => {
    const out: { name: string; items: PermissionInfo[] }[] = [];
    for (const p of data?.permissions ?? []) {
      const group = out.find((g) => g.name === p.group) ?? { name: p.group, items: [] };
      if (!out.includes(group)) out.push(group);
      group.items.push(p);
    }
    return out;
  }, [data]);

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
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="privileges-title"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOutExpo }}
            className="w-full max-w-xl rounded-xl border border-line bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-secondary text-primary">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <h2
                    id="privileges-title"
                    className="font-display text-xl font-black uppercase tracking-wide text-foreground"
                  >
                    Privileges
                  </h2>
                  {/* The same badge the account list shows, so the panel is
                      visibly about the role whose row was clicked — with
                      seventeen of them, "Privileges" alone is not enough of a
                      title. */}
                  <RoleBadge role={user.role} label={role?.label ?? user.roleLabel} className="mt-1" />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                aria-label="Close"
                className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            {/* The whole point of the panel, said once, up front. */}
            <p className="mt-5 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-3 text-sm text-secondary-foreground">
              These apply to the <span className="font-semibold text-foreground">{role?.label ?? user.roleLabel}</span>{" "}
              role, not to {user.name} alone.
              {role && (
                <>
                  {" "}Saving changes what{" "}
                  <span className="font-semibold text-foreground">
                    {role.accountCount === 1 ? "1 account" : `all ${role.accountCount} accounts`}
                  </span>{" "}
                  with this role can do.
                </>
              )}
            </p>

            {loading && !data && (
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={15} className="animate-spin" /> Loading privileges…
              </p>
            )}
            {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
            {data && !role && (
              <p className="mt-6 text-sm text-red-400">This account has no role, so it has nothing to configure.</p>
            )}

            {role && (
              <div className="mt-5 space-y-5">
                {groups.map((group) => (
                  <section key={group.name}>
                    <h3 className="mb-2 font-display text-[11px] font-bold uppercase tracking-widest text-primary">
                      {group.name}
                    </h3>
                    <div className="space-y-1.5">
                      {group.items.map((permission) => {
                        // An ability whose prerequisite is not ticked can't be
                        // granted — name the one that has to come first rather
                        // than just disabling the row with no explanation.
                        const required = permission.requires ? byValue.get(permission.requires) : undefined;
                        const blockedBy =
                          required && !current.includes(required.value) ? required.label : null;

                        return (
                          <PrivilegeRow
                            key={permission.value}
                            permission={permission}
                            checked={current.includes(permission.value) && !blockedBy}
                            blockedBy={blockedBy}
                            disabled={saving}
                            onToggle={() => toggle(permission.value)}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}

                {fixedNote && (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Info size={14} className="mt-px shrink-0" />
                    Only <span className="text-secondary-foreground">{fixedNote}</span> can be
                    adjusted for now — the rest are fixed while the officers agree on what else
                    should move.
                  </p>
                )}

                {editingOwnRole && dirty && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-xs text-amber-300">
                    This is your own role. Reload the admin after saving for the change to show
                    up in your own menus.
                  </p>
                )}
              </div>
            )}

            {formError && <p className="mt-4 text-sm text-red-400">{formError}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              {role?.customized ? (
                <button
                  type="button"
                  onClick={resetToDefaults}
                  disabled={saving}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Reset to defaults
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || !role || !dirty}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-accent disabled:opacity-50"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />} Save privileges
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}

/**
 * One ability. Fixed ones still show their state — greyed, with a padlock — and
 * one whose prerequisite is unticked names what has to be granted first, so an
 * unavailable row is never unexplained.
 */
function PrivilegeRow({
  permission,
  checked,
  blockedBy,
  disabled,
  onToggle,
}: {
  permission: PermissionInfo;
  checked: boolean;
  /** Label of the missing prerequisite, or null when there is nothing blocking. */
  blockedBy: string | null;
  disabled: boolean;
  onToggle: () => void;
}) {
  const fixed = !permission.editable;
  const unavailable = fixed || !!blockedBy;

  return (
    <label
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        unavailable
          ? "cursor-not-allowed border-line/60 bg-white/2"
          : "cursor-pointer border-line bg-secondary/30 hover:border-primary/40"
      }`}
      title={
        blockedBy
          ? `Grant “${blockedBy}” first`
          : fixed
            ? "Fixed for now — not adjustable from this panel"
            : undefined
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={unavailable || disabled}
        className="mt-0.5 size-4 accent-primary disabled:opacity-40"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`text-sm font-medium ${unavailable ? "text-muted-foreground" : "text-foreground"}`}>
            {permission.label}
          </span>
          {fixed && <Lock size={11} className="shrink-0 text-muted-foreground/70" />}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{permission.description}</span>
        {blockedBy && (
          <span className="mt-1 block text-xs text-amber-400/90">Needs “{blockedBy}” first.</span>
        )}
      </span>
    </label>
  );
}
