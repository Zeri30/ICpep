import type { Metadata } from "next";
import { cookies } from "next/headers";
import CheckIn from "@/components/attendance/CheckIn";
import CheckInSignIn from "@/components/attendance/CheckInSignIn";

/* The page an event's QR opens: the officer who scanned it is recorded present.
   Officer-facing, not member-facing — members have no accounts and never check
   in. The QR carries the *event's* token and nothing about a person, so who is
   checking in is answered entirely by the session doing it.

   ## Why this is not under (admin)

   Every other /admin route sits in the (admin) route group, whose layout
   redirects to the landing page the moment /api/admin/me comes back anything
   but OK. That is right for a dashboard and wrong for this: someone has just
   held a phone up to a QR code, and bouncing them to the marketing site with no
   explanation and no way back is the one outcome that makes the whole module
   useless. So this lives in its own group, resolving to the same URL with no
   admin shell around it, and handles the signed-out case itself by asking them
   to sign in and returning them here.

   ⚠ The path is fixed. Event::checkInUrl() has been encoding /admin/check-in
   into QR codes since the scheduler shipped, and those codes are printed and
   photographed artefacts that no deploy can reach. Moving this page breaks
   every QR already handed out.

   Rendered on the server only far enough to know whether there is a session.
   The check-in itself is a POST and belongs on the client — a mutation that
   fires on navigation would run again on every reload and prefetch. */

const BACKEND = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
  .replace("localhost", "127.0.0.1")
  .replace(/\/+$/, "");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Check in — ICpEP.SE",
  // A link that only means anything to a signed-in officer standing in a room
  // has no business in a search index.
  robots: { index: false, follow: false },
};

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Auth only. Everything about the event is fetched by the client component,
  // which has to talk to the API anyway to record the check-in.
  const cookie = (await cookies()).toString();

  const res = await fetch(`${BACKEND}/api/admin/me`, {
    headers: { cookie, accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  // The token rides along so signing in can return to this exact URL. Bouncing
  // a scan to the landing page and back empty-handed would be the same as
  // losing it.
  if (!res || !res.ok) return <CheckInSignIn token={token ?? null} />;

  return <CheckIn token={token ?? null} />;
}
