"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import ConfirmDialog from "@/components/admin/ui/ConfirmDialog";
import { useAdmin } from "@/components/admin/AdminProvider";
import { apiSend, useAdminResource } from "@/lib/adminApi";
import { formatDate, formatDateTime } from "@/lib/adminFormat";
import type { Member } from "@/lib/adminTypes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <section className="rounded-xl border border-line bg-card p-6">
      <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary">{title}</h2>
      <div className={`grid gap-5 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </section>
  );
}

export default function MemberView({ id }: { id: string }) {
  const router = useRouter();
  const { notify } = useAdmin();
  const { data, loading, error } = useAdminResource<{ data: Member }>(`/members/${id}`);
  const [confirm, setConfirm] = useState<"delete" | "restore" | null>(null);
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
          <Link href={`/admin/members/${m.id}/edit`} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <Pencil size={15} /> Edit
          </Link>
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

      <Section title="Member">
        <Field label="Full Name">{m.fullName}</Field>
        <Field label="Class"><Badge tone="red">{m.classCode}</Badge></Field>
        <Field label="Year Level">{m.yearLevel}</Field>
        <Field label="Section">{m.section}</Field>
        <Field label="Birthday">{formatDate(m.birthday)}</Field>
        <Field label="Registered">{formatDateTime(m.createdAt)}</Field>
        <div className="sm:col-span-2"><Field label="Address">{m.address}</Field></div>
        <Field label="Email">{m.email}</Field>
        <Field label="Phone Number">{m.phone}</Field>
      </Section>

      <Section title="Membership Fee">
        <Field label="Status">
          {m.isPaid ? (
            <span className="inline-flex items-center gap-1.5 text-green-400"><CheckCircle2 size={15} /> Paid</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Clock size={15} /> Unpaid</span>
          )}
        </Field>
        <Field label="Date paid">{m.paidAt ? formatDateTime(m.paidAt) : "Not paid yet"}</Field>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Formal Picture" cols={1}>
          {m.pictureUrl ? (
            <Image src={m.pictureUrl} alt={m.fullName} width={400} height={500} unoptimized className="max-h-80 w-auto rounded-lg object-contain" />
          ) : (
            <p className="text-sm text-muted-foreground">No picture on file.</p>
          )}
        </Section>
        <Section title="E-Signature" cols={1}>
          {m.signatureUrl ? (
            <a href={m.signatureUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow">
              <ArrowUpRight size={16} /> Open e-signature file
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">No signature on file.</p>
          )}
        </Section>
      </div>

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
