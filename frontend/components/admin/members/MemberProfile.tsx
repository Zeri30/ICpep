"use client";

/* The member profile's read-only content — fields, payment status, formal
   picture and e-signature. Shared by the full-page view (MemberView) and the
   list's quick-look modal (ViewMemberModal) so both stay in sync instead of
   drifting apart as two copies of the same JSX. */

import Image from "next/image";
import { ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/adminFormat";
import type { Member } from "@/lib/adminTypes";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

export function Section({ title, children, cols = 2 }: { title: string; children: React.ReactNode; cols?: number }) {
  return (
    <section className="rounded-xl border border-line bg-card p-6">
      <h2 className="mb-5 font-display text-sm font-bold uppercase tracking-widest text-primary">{title}</h2>
      <div className={`grid gap-5 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>
    </section>
  );
}

/** The e-signature upload accepts a photo/scan or a signed PDF (see
    Membership.tsx's FileDropField), so a signed URL isn't always an image —
    render it inline when it is, and fall back to an "open file" link when
    it's a PDF. */
function isImageUrl(url: string): boolean {
  const path = url.split("?")[0];
  return /\.(jpe?g|png|webp|gif)$/i.test(path);
}

export default function MemberProfileSections({
  member: m,
  variant = "page",
}: {
  member: Member;
  /** "page" is the full, breathing-room layout for /admin/members/[id]. "compact"
      trims the same information onto one screen for the list's quick-look modal —
      a photo/name header, a tight field grid, and a small signature strip instead
      of three stacked bordered cards. */
  variant?: "page" | "compact";
}) {
  if (variant === "compact") {
    return <CompactMemberProfile member={m} />;
  }

  return (
    <div className="space-y-5">
      <Section title="Member">
        <Field label="Full Name">{m.fullName}</Field>
        <Field label="Student ID">{m.studentId ?? "—"}</Field>
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
            isImageUrl(m.signatureUrl) ? (
              <Image
                src={m.signatureUrl}
                alt={`${m.fullName} signature`}
                width={400}
                height={220}
                unoptimized
                className="max-h-56 w-auto rounded-lg border border-line bg-white object-contain p-3"
              />
            ) : (
              <a href={m.signatureUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow">
                <ArrowUpRight size={16} /> Open e-signature file (PDF)
              </a>
            )
          ) : (
            <p className="text-sm text-muted-foreground">No signature on file.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

function CompactMemberProfile({ member: m }: { member: Member }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {m.pictureUrl ? (
          <Image
            src={m.pictureUrl}
            alt={m.fullName}
            width={80}
            height={80}
            unoptimized
            className="size-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-secondary text-[11px] text-muted-foreground">
            No photo
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-black uppercase tracking-wide text-foreground">{m.fullName}</p>
          <p className="text-xs text-muted-foreground">{m.studentId ?? "No student ID on file"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="red">{m.classCode}</Badge>
            {m.isPaid ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">
                <CheckCircle2 size={11} /> Paid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Clock size={11} /> Unpaid
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {m.isPaid && m.paidAt ? `Paid ${formatDate(m.paidAt)}` : "Not paid yet"}
          </p>
        </div>
      </div>

      {/* Six fields: two even rows at every breakpoint (3-up on sm+, 2-up
          below it), with Address as its own full-width row rather than a
          seventh field left stranded alone at the end of the grid. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-3">
        <Field label="Year Level">{m.yearLevel}</Field>
        <Field label="Section">{m.section}</Field>
        <Field label="Birthday">{formatDate(m.birthday)}</Field>
        <Field label="Phone Number">{m.phone}</Field>
        <Field label="Email">{m.email}</Field>
        <Field label="Registered">{formatDateTime(m.createdAt)}</Field>
        <div className="col-span-2 sm:col-span-3"><Field label="Address">{m.address}</Field></div>
      </div>

      <div className="border-t border-line pt-4">
        <p className="mb-2 font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">E-Signature</p>
        {m.signatureUrl ? (
          isImageUrl(m.signatureUrl) ? (
            <Image
              src={m.signatureUrl}
              alt={`${m.fullName} signature`}
              width={300}
              height={100}
              unoptimized
              className="h-20 w-auto max-w-full rounded-md border border-line bg-white object-contain p-2"
            />
          ) : (
            <a href={m.signatureUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow">
              <ArrowUpRight size={16} /> Open e-signature file (PDF)
            </a>
          )
        ) : (
          <p className="text-sm text-muted-foreground">No signature on file.</p>
        )}
      </div>
    </div>
  );
}
