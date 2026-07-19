"use client";

/* The membership list the admin is currently looking at, shared by every module
   so the Members table, the Dashboard figures and the Payment ledger always
   describe the same semester.

   The selection is a *view* preference and lives in localStorage, deliberately
   separate from which list is current on the server: an officer browsing last
   semester's roster has not changed where new applicants go. Anything the
   server treats as authoritative — which list is current, whether the form is
   open — is read from the API and never cached here. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAdminResource } from "@/lib/adminApi";
import type { MembershipTerm, RegistrationStatus } from "@/lib/adminTypes";

const STORAGE_KEY = "icpep.admin.termId";

type TermContextValue = {
  terms: MembershipTerm[];
  /** The list being viewed, or null before the first load. */
  selected: MembershipTerm | null;
  /** The list new applicants are filed under. */
  current: MembershipTerm | null;
  /** True when viewing a historical list — modules use it to show a read-only notice. */
  isViewingPast: boolean;
  selectTerm: (id: number) => void;
  /** Append the viewed term to an admin API query string. */
  termParam: string;
  registration: RegistrationStatus | null;
  refreshTerms: () => Promise<void>;
  refreshRegistration: () => Promise<void>;
  loading: boolean;
};

const TermContext = createContext<TermContextValue | null>(null);

export function useTerms(): TermContextValue {
  const ctx = useContext(TermContext);
  if (!ctx) throw new Error("useTerms must be used within MembershipTermProvider");
  return ctx;
}

export default function MembershipTermProvider({ children }: { children: React.ReactNode }) {
  const { data: termData, loading, refresh: refreshTerms } = useAdminResource<{ data: MembershipTerm[] }>("/terms");
  const { data: registration, refresh: refreshRegistration } =
    useAdminResource<RegistrationStatus>("/registration");

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const terms = useMemo(() => termData?.data ?? [], [termData]);
  const current = useMemo(() => terms.find((t) => t.isCurrent) ?? null, [terms]);

  const selectTerm = useCallback((id: number) => {
    setSelectedId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      /* private browsing — the selection just won't survive a reload */
    }
  }, []);

  // Settle on a list once they arrive: the one last viewed if it still exists,
  // otherwise the current one. A remembered list that has since been deleted
  // must not leave the modules showing nothing.
  useEffect(() => {
    if (!terms.length) return;
    if (selectedId !== null && terms.some((t) => t.id === selectedId)) return;

    let remembered: number | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      remembered = raw ? Number(raw) : null;
    } catch {
      /* ignore */
    }

    const fallback = terms.find((t) => t.id === remembered) ?? current ?? terms[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(fallback.id);
  }, [terms, selectedId, current]);

  const selected = useMemo(
    () => terms.find((t) => t.id === selectedId) ?? null,
    [terms, selectedId],
  );

  const value = useMemo<TermContextValue>(
    () => ({
      terms,
      selected,
      current,
      isViewingPast: selected !== null && !selected.isCurrent,
      selectTerm,
      termParam: selected ? `term=${selected.id}` : "",
      registration: registration ?? null,
      refreshTerms,
      refreshRegistration,
      loading,
    }),
    [terms, selected, current, selectTerm, registration, refreshTerms, refreshRegistration, loading],
  );

  return <TermContext.Provider value={value}>{children}</TermContext.Provider>;
}
