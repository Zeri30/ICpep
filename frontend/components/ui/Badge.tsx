import type { ReactNode } from "react";

type Tone = "red" | "amber" | "slate" | "dark";

const TONES: Record<Tone, string> = {
  red: "bg-primary/10 text-primary-glow border-primary/30",
  amber: "bg-amber-accent/10 text-amber-accent border-amber-accent/30",
  slate: "bg-slate-accent/10 text-slate-accent border-slate-accent/30",
  dark: "bg-white/5 text-secondary-foreground border-line",
};

/* Same tone identity carried through the border, but for a badge sitting
   directly on a photo instead of the card background. The near-transparent
   chip above assumes a dark card behind it; over an arbitrary image it can
   go either invisible (light photo) or blend into the artwork (similarly
   toned photo). A near-opaque blurred backdrop plus white text is the one
   combination that reads at AA contrast no matter the photo's own colour or
   brightness — a tone-tinted text colour can't promise that on its own
   (slate-accent in particular can't clear 4.5:1 against any backdrop short
   of pure black, so it's not a case of just darkening the chip further). */
const ON_IMAGE_TONES: Record<Tone, string> = {
  red: "border-primary/50",
  amber: "border-amber-accent/50",
  slate: "border-slate-accent/50",
  dark: "border-white/30",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  /** This badge sits on a photo, not the card background — see ON_IMAGE_TONES. */
  onImage?: boolean;
}

export default function Badge({ children, tone = "red", className = "", onImage = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
        onImage
          ? `bg-black/80 text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-sm ${ON_IMAGE_TONES[tone]}`
          : TONES[tone]
      } ${className}`}
    >
      {children}
    </span>
  );
}
