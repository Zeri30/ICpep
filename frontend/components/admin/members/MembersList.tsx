"use client";

/* Members List — filters + search + sort + pagination, per-row actions (payment
   actions, view, edit, downloads, delete/restore) and bulk actions.

   Every action that moves money is confirmed first and acts only on the ticked
   rows, EXCEPT the per-row payment toggle, which applies instantly — a single
   row is a small enough blast radius that a beat of confirmation just slows
   down the common case of working down a list one member at a time. Nothing
   here operates on the whole filtered set: a single click should not be able
   to rewrite a semester's payment records. */

import Image from "next/image";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  Loader2,
  MoreVertical,
  Pencil,
  RotateCcw,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { useTerms } from "@/components/admin/MembershipTermProvider";
import TermBar from "@/components/admin/members/TermBar";
import Badge from "@/components/ui/Badge";
import ConfirmDialog, { type ConfirmTone } from "@/components/admin/ui/ConfirmDialog";
import DataTable, { type Column, type SortState } from "@/components/admin/ui/DataTable";
import ExportMenu from "@/components/admin/ui/ExportMenu";
import Pagination from "@/components/admin/ui/Pagination";
import MembersFilters, { EMPTY_FILTERS, type MemberFilters } from "@/components/admin/members/MembersFilters";
import EditMemberModal from "@/components/admin/members/EditMemberModal";
import ViewMemberModal from "@/components/admin/members/ViewMemberModal";
import { useMembersListResource } from "@/components/admin/members/useMembersListResource";
import { Bar, Circle, PaginationSkeleton, Pill } from "@/components/admin/ui/Skeleton";
import { apiGet, apiSend, markModuleViewed } from "@/lib/adminApi";
import { formatDateTime } from "@/lib/adminFormat";
import type { Member, Paginated } from "@/lib/adminTypes";
import { useOutsideClick } from "@/lib/useOutsideClick";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";

/** The six bulk payment verbs — see MemberController::bulk()'s PAYMENT_ACTIONS. */
type PaymentAction =
  | "payment1_paid" | "payment1_unpaid"
  | "payment2_paid" | "payment2_unpaid"
  | "both_paid" | "both_unpaid";

type Confirm =
  | { kind: "delete"; member: Member }
  | { kind: "restore"; member: Member }
  | { kind: "bulk"; action: "delete" | "restore" }
  /** Payment carries its counts so the dialog can say exactly what will change. */
  | { kind: "payment"; action: PaymentAction; eligible: number; skipped: number }
  | null;

/** What `POST /members/bulk` reports changed, for a payment action. */
type BulkPaymentUpdate = {
  id: number;
  isPayment1Paid: boolean;
  payment1PaidAt: string | null;
  isPayment2Paid: boolean;
  payment2PaidAt: string | null;
};

/**
 * How many placeholder rows to draw while the first page is in flight.
 *
 * Twenty because that is the page size the API returns (MemberController's
 * `perPage` default), so the skeleton stands in the space the real rows are
 * about to take — same height, same scroll extent, nothing jumps when they
 * land. A smaller, "nicer" number would leave the table to grow on arrival,
 * which is the layout shift this is here to remove.
 */
const SKELETON_ROWS = 20;

function PaymentPill({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">
      <CheckCircle2 size={12} /> Paid
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Clock size={12} /> Unpaid
    </span>
  );
}

/** Whether a member is eligible for a given bulk payment action — mirrors
    MemberController::bulk()'s eligibility per action exactly, so the confirm
    dialog's eligible/skipped counts never promise more than the backend does. */
function eligibleForPaymentAction(m: Member, action: PaymentAction): boolean {
  switch (action) {
    case "payment1_paid":
      return !m.isPayment1Paid;
    case "payment1_unpaid":
      // Reverse-order rule: can't revoke Payment 1 while Payment 2 is paid.
      return m.isPayment1Paid && !m.isPayment2Paid;
    case "payment2_paid":
      // Payment 2 needs Payment 1 first.
      return m.isPayment1Paid && !m.isPayment2Paid;
    case "payment2_unpaid":
      return m.isPayment2Paid;
    case "both_paid":
      return !m.isPayment1Paid || !m.isPayment2Paid;
    case "both_unpaid":
      return m.isPayment1Paid || m.isPayment2Paid;
  }
}

/** Copy + tone for each bulk payment action's button, confirm dialog and toast. */
const PAYMENT_ACTION_COPY: Record<PaymentAction, { label: string; noun: string; tone: ConfirmTone }> = {
  payment1_paid: { label: "Payment 1 as Paid", noun: "Payment 1", tone: "success" },
  payment2_paid: { label: "Payment 2 as Paid", noun: "Payment 2", tone: "success" },
  both_paid: { label: "Both Payments as Paid", noun: "both payments", tone: "success" },
  payment1_unpaid: { label: "Payment 1 as Unpaid", noun: "Payment 1", tone: "danger" },
  payment2_unpaid: { label: "Payment 2 as Unpaid", noun: "Payment 2", tone: "danger" },
  both_unpaid: { label: "Both Payments as Unpaid", noun: "both payments", tone: "danger" },
};

/** Whether a bulk-updated row still belongs under the active Payment filter. */
function matchesPaymentFilter(u: BulkPaymentUpdate, filter: string): boolean {
  switch (filter) {
    case "p1_paid": return u.isPayment1Paid;
    case "p1_unpaid": return !u.isPayment1Paid;
    case "p2_paid": return u.isPayment2Paid;
    case "p2_unpaid": return !u.isPayment2Paid;
    case "both_paid": return u.isPayment1Paid && u.isPayment2Paid;
    case "both_unpaid": return !u.isPayment1Paid && !u.isPayment2Paid;
    case "p1_paid_p2_unpaid": return u.isPayment1Paid && !u.isPayment2Paid;
    case "p1_unpaid_p2_paid": return !u.isPayment1Paid && u.isPayment2Paid;
    default: return true;
  }
}

export default function MembersList() {
  const { notify, can } = useAdmin();
  // Which semester's membership list is being shown. Shared with the Dashboard
  // and the payment ledger so all three describe the same roster.
  const { selected: term, loading: termsLoading, initialTermId } = useTerms();
  // Fire right away rather than waiting on `/terms` to resolve: `selected`
  // isn't known yet on first paint, but `initialTermId` (read synchronously
  // from localStorage) is, and omitting `term` entirely falls back to the
  // server's own default (the current list) — either way this is never wrong
  // for longer than it takes `selected` to resolve, at which point its real id
  // takes over below and the query string change refetches automatically. See
  // Dashboard.tsx for the same pattern.
  const termId = term?.id ?? initialTermId;
  const canEdit = can("members.edit");
  const canPay = can("members.payment");
  const canSelect = canEdit || canPay; // any bulk action needs one of these

  const [filters, setFilters] = useState<MemberFilters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "createdAt", direction: "desc" });
  const [page, setPage] = useState(1);
  // Keyed by id but holding the row itself: selection survives paging, so the
  // payment actions need each member's current paid state to report honestly
  // what they will change — the ids alone can't answer that off-page.
  const [selected, setSelected] = useState<Map<number, Member>>(new Map());
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [paymentMenuFor, setPaymentMenuFor] = useState<number | null>(null);
  // Per-member-per-batch payment toggle currently in flight, keyed
  // "<memberId>:<batch>" — disables that row's Payment actions trigger and
  // swaps it for a spinner, so a second click while the first request is
  // still out can't fire a duplicate toggle (which would double the ledger
  // entry and the success toast).
  const [pendingPayments, setPendingPayments] = useState<Set<string>>(new Set());

  // Opening the list clears its sidebar badge — see markModuleViewed.
  useEffect(() => {
    markModuleViewed("members");
  }, []);

  // Debounce only the free-text search; selects apply immediately.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filters.search), 350);
    return () => clearTimeout(id);
  }, [filters.search]);

  // Switching lists is a different dataset, not a filter of the current one —
  // start at page 1 with nothing carried over from the previous list's rows.
  // Adjusted during render (React's documented reset-on-change pattern) rather
  // than in an effect, so no render ever pairs the new term with a stale page.
  // Tracks `termId` (the guess-or-resolved id the query string actually uses),
  // not `term?.id` directly — otherwise the moment `/terms` resolves and
  // confirms the same id the guess already had, this would misread that as a
  // term switch and reset the page/selection for no reason.
  const [renderedTermId, setRenderedTermId] = useState(termId);
  if (termId !== renderedTermId) {
    setRenderedTermId(termId);
    setPage(1);
    setSelected(new Map());
  }

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (termId) p.set("term", String(termId));
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filters.class) p.set("class", filters.class);
    if (filters.year) p.set("year", filters.year);
    if (filters.payment) p.set("payment", filters.payment);
    if (filters.trashed) p.set("trashed", filters.trashed);
    if (sort) {
      p.set("sort", sort.key);
      p.set("direction", sort.direction);
    }
    p.set("page", String(page));
    return p.toString();
  }, [termId, debouncedSearch, filters, sort, page]);

  // Same filters/search/sort as the table, minus pagination — an export always
  // covers every matching row, not just the page currently on screen.
  const exportQueryString = useMemo(() => {
    const p = new URLSearchParams(queryString);
    p.delete("page");
    return p.toString();
  }, [queryString]);

  const { data, error, fetching, refresh, mutate } = useMembersListResource<Paginated<Member>>(
    `/members?${queryString}`,
  );

  // Any filter/sort change returns to page 1 and drops the selection.
  const changeFilters = (next: MemberFilters) => {
    setFilters(next);
    setPage(1);
    setSelected(new Map());
  };
  const onSort = (key: string) => {
    setSort((s) => (s?.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
    setPage(1);
  };

  // Which semester the rows in `data` were fetched for. Recorded during render
  // on the same reset-on-change pattern as the page reset above, so no render
  // can pair one semester's heading with another semester's members. Tracks
  // `termId`, not `term?.id` — `data` can arrive from a request fired off the
  // `initialTermId` guess before `term` itself resolves, so comparing against
  // `term?.id` (still undefined at that point) would wrongly read the data as
  // belonging to a different semester the instant `term` catches up, even
  // when the guess was correct all along.
  const [dataTermId, setDataTermId] = useState(termId);
  const [lastData, setLastData] = useState(data);
  if (data !== lastData) {
    setLastData(data);
    setDataTermId(termId);
  }

  // Switching semester is a different dataset, not a filter of the current one
  // — the page reset above already says so. The rows on screen belong to the
  // semester just left, so they are dropped rather than left sitting under the
  // new one's heading, and the placeholders come back exactly as on a cold
  // load. Paging, sorting and filtering keep their rows: same dataset, and
  // swapping real content for twenty shimmering bars disrupts more than the
  // wait does.
  const otherTerm = data !== null && termId !== dataTermId;
  const rows = otherTerm ? [] : (data?.data ?? []);

  /* Deliberately not gated on the hook's `loading`: that flag starts true and
     never goes true again, so it describes the first fetch and nothing else —
     on a semester switch it is already false. Having no rows for the selected
     semester is the real condition. `error` has to win over it, or a switch
     that failed would shimmer forever instead of saying what went wrong. */
  const awaitingRows = !error && (data === null || otherTerm);

  /* -------------------------------------------------------------- mutations */

  async function run(action: () => Promise<unknown>, success: string, body?: string) {
    try {
      await action();
      await refresh();
      notify(success, body ? { body } : undefined);
    } catch (e) {
      notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
    }
  }

  /**
   * Per-row payment toggle — applies instantly, no confirm dialog. A single
   * row is a small enough blast radius that the beat of confirmation the bulk
   * actions still get would only slow down the common case of working down
   * the list one member at a time. The backend still enforces the sequencing
   * rule (Payment 2 needs Payment 1; revoking unwinds in reverse order) and
   * its 422 message surfaces through the same failure toast as any other
   * action here if the disabled state in the menu is somehow bypassed.
   *
   * Not routed through `run()`: that helper always follows up with a full
   * list refetch, which costs more the larger the current filtered list is
   * (a fresh COUNT + page query) — and it's pure waste here, since
   * toggle-paid's response is already the member's full post-toggle state.
   * The row is patched in place from that response via applyPaymentUpdate
   * instead, the same path the bulk actions and the payment-sync poll use.
   */
  async function togglePayment(member: Member, batch: 1 | 2) {
    const key = `${member.id}:${batch}`;
    // The trigger is disabled while this key is pending, but guard here too:
    // the disabled state only takes effect on the next render, so a second
    // invocation landing before then must still be refused.
    if (pendingPayments.has(key)) return;

    setPendingPayments((s) => new Set(s).add(key));
    const wasPaid = batch === 1 ? member.isPayment1Paid : member.isPayment2Paid;
    try {
      const { data: updated } = await apiSend<{ data: Member }>(
        "POST", `/members/${member.id}/toggle-paid`, { batch },
      );
      applyPaymentUpdate([{
        id: updated.id,
        isPayment1Paid: updated.isPayment1Paid,
        payment1PaidAt: updated.payment1PaidAt,
        isPayment2Paid: updated.isPayment2Paid,
        payment2PaidAt: updated.payment2PaidAt,
      }]);
      notify(wasPaid ? `Payment ${batch} revoked` : `Payment ${batch} marked as paid`);
    } catch (e) {
      notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
    } finally {
      setPendingPayments((s) => {
        const next = new Set(s);
        next.delete(key);
        return next;
      });
    }
  }

  /**
   * Per-row "both payments" shortcut — same instant-apply, no-confirm
   * philosophy as togglePayment above, but routed through the bulk endpoint
   * with a single-member id list instead of two separate toggle-paid calls.
   * That gets this one row the same guarantee the toolbar's bulk action
   * already has: bulkSetBothPayments runs inside one DB::transaction, so
   * Payment 1 and Payment 2 either both land or neither does — no
   * in-between state from a request that fails partway. The response's
   * `updated` row is patched in directly via applyPaymentUpdate, the same
   * path the 10s payment-sync poll already uses, instead of paying for a
   * full page refetch just to repaint two fields whose new values just came
   * back in the response.
   */
  async function toggleBothPayments(member: Member, target: "paid" | "unpaid") {
    const key1 = `${member.id}:1`;
    const key2 = `${member.id}:2`;
    if (pendingPayments.has(key1) || pendingPayments.has(key2)) return;

    const action: PaymentAction = target === "paid" ? "both_paid" : "both_unpaid";
    if (!eligibleForPaymentAction(member, action)) return;

    setPendingPayments((s) => new Set(s).add(key1).add(key2));
    try {
      const { updated } = await apiSend<{ count: number; updated: BulkPaymentUpdate[] }>(
        "POST", "/members/bulk", { ids: [member.id], action },
      );
      applyPaymentUpdate(updated);
      notify(target === "paid" ? "Both payments marked as paid" : "Both payments revoked");
    } catch (e) {
      notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
    } finally {
      setPendingPayments((s) => {
        const next = new Set(s);
        next.delete(key1);
        next.delete(key2);
        return next;
      });
    }
  }

  /**
   * Open the confirmation for a bulk payment action over the selection.
   *
   * Refuses before asking rather than after: a confirm dialog that leads to "0
   * updated" is worse than being told up front that nothing is ticked. The
   * eligible count excludes members the backend would skip (already in the
   * target state, or not sequence-eligible), so the dialog never promises more
   * than happens.
   */
  function requestPayment(action: PaymentAction) {
    if (selected.size === 0) {
      notify("No members selected", {
        tone: "warning",
        body: "Tick the checkbox beside each member you want to update.",
      });
      return;
    }

    const members = [...selected.values()];
    const eligible = members.filter((m) => eligibleForPaymentAction(m, action));

    if (eligible.length === 0) {
      notify("Nothing to update", {
        tone: "warning",
        body:
          members.length === 1
            ? "The selected member isn't eligible for this action."
            : `None of the ${members.length} selected members are eligible for this action.`,
      });
      return;
    }

    setConfirm({ kind: "payment", action, eligible: eligible.length, skipped: members.length - eligible.length });
  }

  /**
   * Patches the rows a bulk payment action reports as changed, instead of
   * paying for a full re-fetch of the page just to repaint fields whose new
   * values are already known — see useMembersListResource's `mutate`. A row
   * that no longer matches the active Payment filter is dropped from the
   * page rather than patched in place, since patching it would leave (say) a
   * newly-"Paid" row sitting under the "Payment 1 – Unpaid" filter until the
   * next real refresh caught up.
   */
  function applyPaymentUpdate(updates: BulkPaymentUpdate[]) {
    if (updates.length === 0) return;
    const byId = new Map(updates.map((u) => [u.id, u]));

    mutate((prev) => {
      if (!prev) return prev;
      let dropped = 0;
      const rows = prev.data.flatMap((row) => {
        const change = byId.get(row.id);
        if (!change) return [row];
        if (filters.payment && !matchesPaymentFilter(change, filters.payment)) {
          dropped++;
          return [];
        }
        return [{
          ...row,
          isPayment1Paid: change.isPayment1Paid,
          payment1PaidAt: change.payment1PaidAt,
          isPayment2Paid: change.isPayment2Paid,
          payment2PaidAt: change.payment2PaidAt,
        }];
      });

      if (dropped === 0) return { ...prev, data: rows };
      return {
        data: rows,
        meta: { ...prev.meta, total: prev.meta.total - dropped, to: prev.meta.to === null ? prev.meta.to : prev.meta.to - dropped },
      };
    });
  }

  /**
   * Real-time sync: every few seconds, ask the server which members' payment
   * state has changed since the last check (see MemberController::changes)
   * and patch just those rows in — through the exact same applyPaymentUpdate
   * a bulk action's own response already goes through — so a payment another
   * officer records elsewhere shows up here without a manual refresh, without
   * ever refetching the whole page. Paused while the tab is hidden and caught
   * back up on becoming visible again — see useVisibilityInterval.
   *
   * `sinceRef` is a cursor, not state: it moves forward on every poll (using
   * the checkpoint the server hands back, not the client's own clock) and
   * doesn't need to trigger a re-render. `applyRef` holds the latest
   * `applyPaymentUpdate` (which closes over `filters` and `mutate`), and
   * `pollRef` the latest poll tick itself (which closes over `termId` and
   * `sinceRef`) — useVisibilityInterval is called once, unconditionally, with
   * a stable wrapper that always calls through to whichever closure is
   * current, rather than needing to restart on every term/filter change.
   */
  const applyRef = useRef(applyPaymentUpdate);
  useEffect(() => {
    applyRef.current = applyPaymentUpdate;
  });

  const sinceRef = useRef(new Date().toISOString());
  const pollRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!termId) return;

    sinceRef.current = new Date().toISOString();
    pollRef.current = async () => {
      try {
        const qs = new URLSearchParams({ term: String(termId), since: sinceRef.current });
        const { updated, since } = await apiGet<{ updated: BulkPaymentUpdate[]; since: string }>(
          `/members/changes?${qs}`,
        );
        sinceRef.current = since;
        applyRef.current(updated);
      } catch {
        // Best-effort — a missed poll just means the next one catches up;
        // `since` only advances on a successful response, so nothing is
        // skipped over.
      }
    };
  }, [termId]);

  useVisibilityInterval(() => {
    pollRef.current();
  }, termId ? 10_000 : null);

  async function confirmAction() {
    if (!confirm) return;
    const ids = [...selected.keys()];

    if (confirm.kind === "delete") {
      await run(() => apiSend("DELETE", `/members/${confirm.member.id}`), "Member deleted");
    } else if (confirm.kind === "restore") {
      await run(() => apiSend("POST", `/members/${confirm.member.id}/restore`), "Member restored");
    } else if (confirm.kind === "bulk") {
      await run(async () => {
        const { count } = await apiSend<{ count: number }>("POST", "/members/bulk", { ids, action: confirm.action });
        setSelected(new Map());
        return count;
      }, "Bulk update applied");
    } else if (confirm.kind === "payment") {
      const { action, eligible, skipped } = confirm;
      // Not routed through `run()`: that helper always follows up with a full
      // refetch, which is exactly the round trip this path exists to skip —
      // the endpoint already reports what changed, so the rows are patched
      // in place from its response instead.
      try {
        const { updated } = await apiSend<{ count: number; updated: BulkPaymentUpdate[] }>(
          "POST", "/members/bulk", { ids, action },
        );
        applyPaymentUpdate(updated);
        setSelected(new Map());
        notify(
          `${eligible} member${eligible === 1 ? "" : "s"} updated`,
          skipped > 0 ? { body: `${skipped} not eligible for this action — left unchanged.` } : undefined,
        );
      } catch (e) {
        notify("Action failed", { tone: "warning", body: e instanceof Error ? e.message : undefined });
      }
    }

    setConfirm(null);
  }

  /* ---------------------------------------------------------- selection ui */

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Map(s);
      // Scoped to this page: untick clears only what's visible, leaving any
      // off-page selection the officer built up intact.
      if (allChecked) rows.forEach((r) => n.delete(r.id));
      else rows.forEach((r) => n.set(r.id, r));
      return n;
    });
  const toggleOne = (m: Member) =>
    setSelected((s) => {
      const n = new Map(s);
      if (n.has(m.id)) n.delete(m.id);
      else n.set(m.id, m);
      return n;
    });

  const showRestoreBulk = filters.trashed === "with" || filters.trashed === "only";

  /* ------------------------------------------------------------- columns */

  const columns: Column<Member>[] = [
    ...(canSelect
      ? [
          {
            key: "select",
            // Select-all rides in the column header rather than a row of its
            // own above the table — same control, one less band of chrome.
            header: (
              <input
                type="checkbox"
                checked={allChecked}
                onChange={toggleAll}
                className="size-4 accent-primary align-middle"
                aria-label="Select all on this page"
                title="Select all on this page"
              />
            ),
            render: (m: Member) => (
              <input
                type="checkbox"
                checked={selected.has(m.id)}
                onChange={() => toggleOne(m)}
                className="size-4 accent-primary"
                aria-label={`Select ${m.fullName}`}
              />
            ),
            skeleton: <span className="skeleton inline-block size-4 rounded-sm" />,
          },
        ]
      : []),
    {
      key: "photo",
      header: "Photo",
      render: (m) =>
        m.photoUrl ? (
          <Image src={m.photoUrl} alt="" width={40} height={40} className="size-10 rounded-full object-cover" unoptimized />
        ) : (
          <span className="grid size-10 place-items-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
            {m.givenName?.[0]}
            {m.surname?.[0]}
          </span>
        ),
      // The avatar is what sets the row's height, so this one is load-bearing:
      // a shorter placeholder here and every row grows when the photos arrive.
      // `block` rather than inline-block for the same reason — an inline box
      // sits on the text baseline and carries the descender space with it,
      // which measured 5px taller per row than the real (block) avatar.
      skeleton: <Circle />,
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (m) => (
        <div>
          <p className="font-medium text-foreground">{m.fullName}</p>
          <p className="text-xs text-muted-foreground">{m.email}</p>
        </div>
      ),
      // Two lines, because the cell has two — name over email.
      skeleton: (
        <div className="flex flex-col gap-1.5">
          <Bar w="w-32" />
          <Bar w="w-44" h="h-3" />
        </div>
      ),
    },
    // The widths below are not decorative — the table is auto-layout, so each
    // placeholder's width is what holds its column open. They were measured
    // against a loaded table and trimmed to match; see SKELETON_ROWS.
    { key: "class", header: "Class", render: (m) => <Badge tone="red">{m.classCode}</Badge>, skeleton: <Pill w="w-12" /> },
    { key: "phone", header: "Phone", render: (m) => <span className="text-secondary-foreground">{m.phone}</span>, skeleton: <Bar w="w-24" /> },
    { key: "paidAt", header: "Payment 1", sortable: true, render: (m) => <PaymentPill paid={m.isPayment1Paid} />, skeleton: <Pill w="w-20" /> },
    { key: "payment2PaidAt", header: "Payment 2", sortable: true, render: (m) => <PaymentPill paid={m.isPayment2Paid} />, skeleton: <Pill w="w-20" /> },
    { key: "createdAt", header: "Registered", sortable: true, render: (m) => <span className="whitespace-nowrap text-secondary-foreground">{formatDateTime(m.createdAt)}</span>, skeleton: <Bar w="w-40" /> },
    {
      key: "actions",
      header: "",
      align: "right",
      // Same square buttons the real row ends with, so the column keeps its
      // width instead of collapsing to nothing and shoving the rest across.
      skeleton: (
        <div className="flex items-center justify-end gap-1">
          {canPay && <span className="skeleton inline-block size-8 rounded-md" />}
          <span className="skeleton inline-block size-8 rounded-md" />
        </div>
      ),
      render: (m) =>
        m.deletedAt ? (
          canEdit ? (
            <button
              onClick={() => setConfirm({ kind: "restore", member: m })}
              title="Undo delete"
              className="grid size-8 place-items-center rounded-md text-green-400 transition-colors hover:bg-green-500/10"
            >
              <RotateCcw size={16} />
            </button>
          ) : null
        ) : (
          <div className="flex items-center justify-end gap-1">
            {canPay && (
              <PaymentActionsMenu
                open={paymentMenuFor === m.id}
                onOpen={() => setPaymentMenuFor(m.id)}
                onClose={() => setPaymentMenuFor(null)}
                member={m}
                onToggle={(batch) => togglePayment(m, batch)}
                onToggleBoth={(target) => toggleBothPayments(m, target)}
                pending={pendingPayments.has(`${m.id}:1`) || pendingPayments.has(`${m.id}:2`)}
              />
            )}
            <RowMenu
              open={menuFor === m.id}
              onOpen={() => setMenuFor(m.id)}
              onClose={() => setMenuFor(null)}
              member={m}
              canEdit={canEdit}
              onView={() => setViewing(m.id)}
              onEdit={() => setEditing(m)}
              onDelete={() => setConfirm({ kind: "delete", member: m })}
            />
          </div>
        ),
    },
  ];

  return (
    // On a wide screen the module fills exactly the space below the 72px topbar
    // (less the main element's py-8) and scrolls the rows inside the table, so
    // the page itself never scrolls and the pager stays put. Narrow screens keep
    // the natural flow, where a page scroll is the better behaviour.
    <div className="flex flex-col gap-4 lg:h-[calc(100vh-72px-4rem)] lg:min-h-0">
      <TermBar />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">Members List</h1>
          {/* The term arrives on its own request, after the heading has already
              painted. Rendered as a placeholder rather than nothing, because
              this line is above the table — letting it appear late pushed the
              whole card down 24px just as the rows were landing. The bar is
              sized to the text's own line box (16px + the 2px margins) so the
              swap changes nothing. */}
          {term ? (
            <p className="mt-1 text-sm text-muted-foreground">{term.label}</p>
          ) : termsLoading ? (
            <p className="mt-1">
              <span className="skeleton my-0.5 block h-4 w-40 rounded" />
            </p>
          ) : null}
        </div>
        {/* Open to every role — reading the list is all it takes to export it. */}
        <ExportMenu base="/api/admin/members/export" queryString={exportQueryString} />
      </div>

      {/* Filters and the bulk actions share one row: the selection controls
          replace nothing and push nothing down, so the table keeps its height
          whether or not rows are selected. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <MembersFilters
          value={filters}
          onChange={changeFilters}
          // Covers both halves of the wait: the debounce timer (search text
          // not yet matching what was last sent) and the request it fires
          // off. Scoped to a non-empty search box so filtering by class or
          // year alone — no search term in flight — never spins this icon.
          searching={!!filters.search && (filters.search !== debouncedSearch || fetching)}
        />

        {selected.size > 0 && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm sm:ml-auto sm:w-auto">
            <span className="font-medium text-foreground">{selected.size} selected</span>
            <div className="mx-0.5 h-4 w-px bg-line" />
            {canPay && <BulkPaymentMenu onAction={requestPayment} />}
            {canEdit && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "delete" })} tone="danger">Delete</BulkBtn>}
            {canEdit && showRestoreBulk && <BulkBtn onClick={() => setConfirm({ kind: "bulk", action: "restore" })}>Undo delete</BulkBtn>}
            <button
              onClick={() => setSelected(new Map())}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      <DataTable
        fill
        columns={columns}
        rows={rows}
        rowKey={(m) => m.id}
        loading={awaitingRows}
        skeletonRows={SKELETON_ROWS}
        error={error}
        sort={sort}
        onSort={onSort}
        emptyHeading="No members found"
        emptyDescription="Try clearing the filters, or wait for new registrations from the public form."
        // The pager is part of the card's height, so it gets a placeholder too
        // — otherwise the band appears with the data and shoves the table up.
        // It also has to give way on a semester switch, or the pager would
        // still be reporting the previous semester's totals.
        footer={
          awaitingRows ? (
            <PaginationSkeleton />
          ) : data ? (
            // Disabled while a page/sort/filter fetch for this same term is in
            // flight — a click here would otherwise queue a second, overlapping
            // request whose response can land before or after the first.
            <Pagination meta={data.meta} onPage={setPage} disabled={fetching} />
          ) : null
        }
      />

      {/* Editing stays on the list, so filters, term and page survive a save. */}
      <EditMemberModal
        member={editing}
        onSaved={refresh}
        onClose={() => setEditing(null)}
      />

      {/* Viewing stays on the list too — no more round-trip to /admin/members/[id]
          and back just to look at a profile. */}
      <ViewMemberModal memberId={viewing} onClose={() => setViewing(null)} />

      {/* Confirmations */}
      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Delete member"
        description="This removes the member from the list. The record is kept (soft delete) and can be undone from the “Only deleted” filter."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "restore"}
        title="Restore member"
        description="Bring this member back to the members list?"
        confirmLabel="Restore"
        tone="success"
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "bulk"}
        title={confirm?.kind === "bulk" && confirm.action === "delete" ? "Delete selected" : "Restore selected"}
        description={`This will ${confirm?.kind === "bulk" ? confirm.action : ""} ${selected.size} selected member${selected.size === 1 ? "" : "s"}.`}
        confirmLabel="Apply"
        tone={confirm?.kind === "bulk" && confirm.action === "delete" ? "danger" : "primary"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />

      {/* Bulk payment actions — the per-row toggle skips this and applies
          instantly (see togglePayment above); a whole selection is worth the
          beat of confirmation a single row isn't. */}
      <ConfirmDialog
        open={confirm?.kind === "payment"}
        title={confirm?.kind === "payment" ? `Mark ${PAYMENT_ACTION_COPY[confirm.action].label}` : "Apply"}
        description={
          confirm?.kind === "payment" ? (
            <>
              {PAYMENT_ACTION_COPY[confirm.action].tone === "success" ? "Record" : "Clear"}{" "}
              {PAYMENT_ACTION_COPY[confirm.action].noun} for{" "}
              <span className="text-foreground">
                {confirm.eligible} selected member{confirm.eligible === 1 ? "" : "s"}
              </span>
              {PAYMENT_ACTION_COPY[confirm.action].tone === "success"
                ? ", with today as the payment date."
                : ". Each fee is reversed in the payment history."}
              {confirm.skipped > 0 && (
                <> {confirm.skipped} not eligible for this action and will be left unchanged.</>
              )}
            </>
          ) : undefined
        }
        // Short on purpose — the title above already states the full action;
        // the button just needs to say which direction it commits to.
        confirmLabel={confirm?.kind === "payment" ? (PAYMENT_ACTION_COPY[confirm.action].tone === "success" ? "Mark Paid" : "Mark Unpaid") : "Apply"}
        tone={confirm?.kind === "payment" ? PAYMENT_ACTION_COPY[confirm.action].tone : "primary"}
        onConfirm={confirmAction}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function BulkBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
        tone === "danger"
          ? "text-red-400 hover:bg-red-500/10"
          : "text-secondary-foreground hover:bg-white/5 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** The selection strip's "Payment actions" dropdown — the six bulk verbs,
    grouped by paid/unpaid, replacing the old flat Mark-paid/Mark-unpaid pair. */
function BulkPaymentMenu({ onAction }: { onAction: (action: PaymentAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => setOpen(false), open);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground";
  const heading = "px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

  const act = (action: PaymentAction) => {
    setOpen(false);
    onAction(action);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground"
      >
        <Wallet size={13} /> Payment actions
        <ChevronDown size={12} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-20 w-64 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <p className={heading}>Mark as paid</p>
          <button onClick={() => act("payment1_paid")} className={item}>{PAYMENT_ACTION_COPY.payment1_paid.label}</button>
          <button onClick={() => act("payment2_paid")} className={item}>{PAYMENT_ACTION_COPY.payment2_paid.label}</button>
          <button onClick={() => act("both_paid")} className={item}>{PAYMENT_ACTION_COPY.both_paid.label}</button>
          <div className="my-1 h-px bg-line" />
          <p className={heading}>Mark as unpaid</p>
          <button onClick={() => act("payment1_unpaid")} className={`${item} text-red-400 hover:text-red-300`}>{PAYMENT_ACTION_COPY.payment1_unpaid.label}</button>
          <button onClick={() => act("payment2_unpaid")} className={`${item} text-red-400 hover:text-red-300`}>{PAYMENT_ACTION_COPY.payment2_unpaid.label}</button>
          <button onClick={() => act("both_unpaid")} className={`${item} text-red-400 hover:text-red-300`}>{PAYMENT_ACTION_COPY.both_unpaid.label}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Per-row payment actions — replaces the old single toggle icon. Each line
 * reflects the member's current state (Mark as Paid vs. Revoke Payment) and
 * applies instantly on click, no confirm dialog (see togglePayment). Payment
 * 2 is disabled until Payment 1 is paid; Payment 1's revoke is disabled while
 * Payment 2 is still paid — both mirror the backend's sequencing rule. The
 * "Mark Both" shortcuts below the divider walk both batches through that
 * same sequencing (see toggleBothPayments) and disable once both are
 * already in the target state.
 *
 * While a toggle for this member is in flight (`pending`), the trigger itself
 * is disabled and shows a spinner in place of the Wallet icon — the menu
 * already closes the instant an item is clicked (see `act`), so the trigger
 * is what a second, duplicate click would actually land on.
 */
function PaymentActionsMenu({
  open,
  onOpen,
  onClose,
  member,
  onToggle,
  onToggleBoth,
  pending,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  member: Member;
  onToggle: (batch: 1 | 2) => void;
  onToggleBoth: (target: "paid" | "unpaid") => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose, open);

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-secondary-foreground";

  // Mirrors MemberController::togglePayment's two guards exactly.
  const payment2Disabled = !member.isPayment1Paid && !member.isPayment2Paid;
  const payment1RevokeDisabled = member.isPayment1Paid && member.isPayment2Paid;
  const bothPaidDisabled = member.isPayment1Paid && member.isPayment2Paid;
  const bothUnpaidDisabled = !member.isPayment1Paid && !member.isPayment2Paid;

  const act = (batch: 1 | 2) => {
    onClose();
    onToggle(batch);
  };

  const actBoth = (target: "paid" | "unpaid") => {
    onClose();
    onToggleBoth(target);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={open ? onClose : onOpen}
        disabled={pending}
        title={pending ? "Updating payment…" : "Payment actions"}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-60 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => act(1)}
            disabled={payment1RevokeDisabled}
            title={payment1RevokeDisabled ? "Revoke Payment 2 first" : undefined}
            className={item}
          >
            {member.isPayment1Paid ? <RotateCcw size={15} /> : <CheckCircle2 size={15} className="text-green-400" />}
            Payment 1 – {member.isPayment1Paid ? "Revoke Payment" : "Mark as Paid"}
          </button>
          <button
            onClick={() => act(2)}
            disabled={payment2Disabled}
            title={payment2Disabled ? "Complete Payment 1 first" : undefined}
            className={item}
          >
            {member.isPayment2Paid ? <RotateCcw size={15} /> : <CheckCircle2 size={15} className="text-green-400" />}
            Payment 2 – {member.isPayment2Paid ? "Revoke Payment" : "Mark as Paid"}
          </button>
          <div className="my-1 border-t border-line" />
          <button
            onClick={() => actBoth("paid")}
            disabled={bothPaidDisabled}
            title={bothPaidDisabled ? "Both payments are already paid" : undefined}
            className={item}
          >
            <CheckCircle2 size={15} className="text-green-400" />
            Mark Both as Paid
          </button>
          <button
            onClick={() => actBoth("unpaid")}
            disabled={bothUnpaidDisabled}
            title={bothUnpaidDisabled ? "Both payments are already unpaid" : undefined}
            className={`${item} text-red-400 hover:text-red-300`}
          >
            <RotateCcw size={15} />
            Mark Both as Unpaid
          </button>
        </div>
      )}
    </div>
  );
}

function RowMenu({
  open,
  onOpen,
  onClose,
  member,
  canEdit,
  onView,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  member: Member;
  canEdit: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, onClose, open);

  const item = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-secondary-foreground transition-colors hover:bg-white/5 hover:text-foreground";

  return (
    <div ref={ref} className="relative">
      <button onClick={open ? onClose : onOpen} title="More" className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
          <button onClick={() => { onClose(); onView(); }} className={item}>
            <Eye size={15} /> View
          </button>
          {canEdit && (
            <button onClick={() => { onClose(); onEdit(); }} className={item}>
              <Pencil size={15} /> Edit
            </button>
          )}
          <a href={`/api/admin/members/${member.id}/download/picture`} className={item} onClick={onClose}>
            <Download size={15} /> Download photo
          </a>
          <a href={`/api/admin/members/${member.id}/download/signature`} className={item} onClick={onClose}>
            <Download size={15} /> Download signature
          </a>
          {canEdit && (
            <button onClick={() => { onClose(); onDelete(); }} className={`${item} text-red-400 hover:text-red-300`}>
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
