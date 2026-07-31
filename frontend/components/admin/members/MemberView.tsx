"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import EditMemberModal from "@/components/admin/members/EditMemberModal";
import MemberProfileSections from "@/components/admin/members/MemberProfile";
import { useAdmin } from "@/components/admin/AdminProvider";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import type { Member } from "@/lib/adminTypes";

export default function MemberView({ id }: { id: string }) {
  const router = useRouter();
  const { notify } = useAdmin();
  const { data, loading, error, refresh } = useAdminResource<{ data: Member }>(`/members/${id}`);
  const [confirm, setConfirm] = useState<"delete" | "restore" | null>(null);
  const [editing, setEditing] = useState(false);
  const m = data?.data;

  async function del() {
    try {
      await apiSend("DELETE", `/members/${id}`);
      notify("Member deleted");
      router.push("/admin/members");
    } catch {
      notify("Delete failed", { tone: "warning" });
    }
  }
  async function restore() {
    try {
      await apiSend("POST", `/members/${id}/restore`);
      notify("Member restored");
      setConfirm(null);
      router.refresh();
      window.location.reload();
    } catch {
      notify("Restore failed", { tone: "warning" });
    }
  }

  if (loading && !m)
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  if (error && !m) return <p className="py-20 text-sm text-red-400">{error}</p>;
  if (!m) return null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/members" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft size={16} /> Members List
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <Pencil size={15} /> Edit
          </button>
          {m.deletedAt ? (
            <button onClick={() => setConfirm("restore")} className="inline-flex items-center gap-2 rounded-md border border-green-500/40 px-3 py-2 text-sm text-green-400 transition-colors hover:bg-green-500/10">
              <RotateCcw size={15} /> Undo delete
            </button>
          ) : (
            <button onClick={() => setConfirm("delete")} className="inline-flex items-center gap-2 rounded-md border border-red-500/40 px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10">
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>

      <h1 className="font-display text-3xl font-black uppercase tracking-wide text-foreground">{m.fullName}</h1>

      <MemberProfileSections member={m} />

      {/* Editing overlays the record rather than replacing it, so the details
          are still there to compare against while typing. */}
      <EditMemberModal
        member={editing ? m : null}
        onSaved={refresh}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        title="Delete member"
        description="This removes the member from the list. The record is kept (soft delete) and can be undone."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={del}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "restore"}
        title="Restore member"
        description="Bring this member back to the members list?"
        confirmLabel="Restore"
        tone="success"
        onConfirm={restore}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
