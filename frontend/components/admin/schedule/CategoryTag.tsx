"use client";

/* The label for an event's category, and the colours the calendar draws it in.

   Each category carries its name as well as its colour wherever it appears —
   the grid chips, the list rows, the legend. Colour alone would leave the
   calendar unreadable to anyone who cannot distinguish two of them, and there
   are eight. */

/** border / background / text classes, and the dot colour for a chip. */
type Tone = { chip: string; dot: string };

const TONES: Record<string, Tone> = {
  Meeting: { chip: "border-sky-500/30 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  Seminar: { chip: "border-violet-500/30 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
  Workshop: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  Competition: { chip: "border-red-500/30 bg-red-500/10 text-red-300", dot: "bg-red-400" },
  "Major Event": { chip: "border-primary/40 bg-primary/15 text-primary", dot: "bg-primary" },
  "General Assembly": { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  Deadline: { chip: "border-orange-500/30 bg-orange-500/10 text-orange-300", dot: "bg-orange-400" },
  Other: { chip: "border-line bg-secondary/60 text-secondary-foreground", dot: "bg-muted-foreground" },
};

// A category retired from Event::CATEGORIES still exists on the rows already
// saved with it, so an unknown name renders neutrally rather than blank.
const FALLBACK = TONES.Other;

export function toneFor(category: string): Tone {
  return TONES[category] ?? FALLBACK;
}

export default function CategoryTag({ category }: { category: string }) {
  const tone = toneFor(category);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone.chip}`}
    >
      <span className={`size-1.5 rounded-full ${tone.dot}`} />
      {category}
    </span>
  );
}
