/* What a dead or unknown share link shows.

   Deliberately says which of the two it is, and why, because the person holding
   the link cannot tell the difference and their next move depends on it — a
   cancelled event means don't turn up, a bad link means ask for another. It
   does not reveal anything about an event beyond the name the sender already
   used when they shared it. */

import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import Logo from "@/components/ui/Logo";

export default function SharedEventUnavailable({
  heading,
  title,
  reason,
}: {
  heading: string;
  /** The event's name, when there was an event behind the link at all. */
  title?: string;
  reason: string;
}) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background px-4">
      <div className="pointer-events-none absolute inset-0 pat-grid opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.10),transparent_60%)]" />

      <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-8 text-center">
        <div className="flex justify-center">
          <Logo size={44} priority />
        </div>

        <span className="mx-auto mt-6 grid size-14 place-items-center rounded-full bg-secondary text-muted-foreground">
          <CalendarX2 size={24} />
        </span>

        <h1 className="mt-5 font-display text-2xl font-black uppercase tracking-wide text-foreground">
          {heading}
        </h1>

        {title && (
          <p className="mt-2 font-head text-xs uppercase tracking-[0.15em] text-secondary-foreground">
            {title}
          </p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{reason}</p>

        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-lg border border-line px-5 py-2.5 font-head text-xs font-semibold uppercase tracking-wide text-secondary-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          Go to ICpEP.SE
        </Link>
      </div>
    </main>
  );
}
