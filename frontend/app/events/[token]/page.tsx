import type { Metadata } from "next";
import SharedEvent, { type SharedEventData } from "@/components/events/SharedEvent";
import SharedEventUnavailable from "@/components/events/SharedEventUnavailable";

/* The page a share link opens: an event's details, its attendance QR and the
   code to type instead. Public — no account, no sign-in.

   Rendered on the server so the QR and the code are in the first paint. Someone
   opens this with a phone held up in a room; a spinner followed by a layout
   shift is the wrong experience for that.

   Force IPv4 and trim trailing slashes for the same reasons the admin layout
   does — a dev server bound to IPv4 only, and a `//api/...` path the backend
   404s. */
const BACKEND = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
  .replace("localhost", "127.0.0.1")
  .replace(/\/+$/, "");

export const dynamic = "force-dynamic";

type Unavailable = { available: false; title?: string; reason?: string };

async function fetchShared(token: string): Promise<SharedEventData | Unavailable | null> {
  // no-store: the link dies the moment the event is cancelled or marked done,
  // and a cached page would keep handing out a QR that no longer stands.
  const res = await fetch(`${BACKEND}/api/events/shared/${encodeURIComponent(token)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);

  if (!res) return null;
  if (res.status === 404) return null;

  const body = await res.json().catch(() => null);
  if (!body) return null;

  return body as SharedEventData | Unavailable;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const data = await fetchShared(token);

  // The title is the one thing that shows in a chat preview when this gets
  // pasted into a group thread, which is exactly how it will be sent.
  const name = data && "title" in data && data.title ? data.title : "Event";

  return {
    title: `${name} — ICpEP.SE`,
    description:
      data && "available" in data && data.available
        ? `${data.dateLabel} at ${data.timeLabel}. Scan the QR or use the attendance code.`
        : "This ICpEP.SE event link is no longer active.",
    // A link handed around a chat group has no business in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function SharedEventPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShared(token);

  if (!data || !("available" in data)) {
    return (
      <SharedEventUnavailable
        heading="Link not found"
        reason="This link is not valid. Check it was copied in full, or ask the Secretary for a new one."
      />
    );
  }

  if (!data.available) {
    return (
      <SharedEventUnavailable
        heading="Link no longer active"
        title={data.title}
        reason={data.reason ?? "This link has expired."}
      />
    );
  }

  return <SharedEvent event={data} />;
}
