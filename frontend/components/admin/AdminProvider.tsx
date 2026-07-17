"use client";

/* Shares the signed-in officer, the small config bundle (fee/currency/options),
   and a toast channel with every admin screen. The officer + meta come from the
   server layout's /api/admin/me fetch, so the client never re-requests them. */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AdminMeta, Officer, Permission } from "@/lib/adminApi";
import Toaster, { type Toast, type ToastTone } from "@/components/admin/ui/Toaster";

type AdminContextValue = {
  officer: Officer;
  meta: AdminMeta;
  /** Format an amount with the configured currency symbol. */
  money: (amount: number) => string;
  /** Does the signed-in officer hold the given ability? Mirrors the backend Gates. */
  can: (permission: Permission) => boolean;
  notify: (title: string, opts?: { body?: string; tone?: ToastTone }) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider");
  return ctx;
}

export default function AdminProvider({
  officer,
  meta,
  children,
}: {
  officer: Officer;
  meta: AdminMeta;
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback<AdminContextValue["notify"]>((title, opts = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, body: opts.body, tone: opts.tone ?? "success" }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  const money = useCallback(
    (amount: number) =>
      `${meta.currency}${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    [meta.currency],
  );

  const can = useCallback<AdminContextValue["can"]>(
    (permission) => officer.permissions.includes(permission),
    [officer.permissions],
  );

  const value = useMemo(
    () => ({ officer, meta, money, can, notify }),
    [officer, meta, money, can, notify],
  );

  return (
    <AdminContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
    </AdminContext.Provider>
  );
}
