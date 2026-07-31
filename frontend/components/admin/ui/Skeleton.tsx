"use client";

/* Shared skeleton placeholder primitives — the shapes every data-driven admin
   list builds its per-column skeletons out of (see DataTable's `skeleton`
   column prop). Kept in one place so every list's placeholders share the same
   sizing vocabulary instead of each re-inventing "a grey bar" slightly
   differently. */

/** A placeholder bar. `w` is a Tailwind width, sized to the copy it stands in. */
export function Bar({ w, h = "h-4" }: { w: string; h?: string }) {
  return <span className={`skeleton inline-block rounded ${h} ${w}`} />;
}

/** A placeholder for pill-shaped cells — badges, status chips, tags. */
export function Pill({ w }: { w: string }) {
  return <span className={`skeleton inline-block h-5 rounded-full ${w}`} />;
}

/** A placeholder for a round avatar/photo. `block` rather than inline-block:
    an inline box sits on the text baseline and carries descender space with
    it, which reads taller than the real (block) avatar it stands in for. */
export function Circle({ size = "size-10" }: { size?: string }) {
  return <span className={`skeleton block ${size} rounded-full`} />;
}

/** The pager's band, in placeholder form. Mirrors Pagination's own padding
    and border so the card is exactly as tall before the data arrives as
    after — otherwise the footer appears with the data and shoves the table
    up by its own height. */
export function PaginationSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/60 bg-card px-4 py-3"
    >
      <Bar w="w-24" h="h-3" />
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="skeleton inline-block size-8 rounded-md" />
        ))}
      </div>
    </div>
  );
}
