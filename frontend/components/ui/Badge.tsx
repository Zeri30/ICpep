import type { ReactNode } from "react";

type Tone = "red" | "amber" | "slate" | "dark";

const TONES: Record<Tone, string> = {
  red: "bg-primary/10 text-primary-glow border-primary/30",
  amber: "bg-amber-accent/10 text-amber-accent border-amber-accent/30",
  slate: "bg-slate-accent/10 text-slate-accent border-slate-accent/30",
  dark: "bg-white/5 text-secondary-foreground border-line",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export default function Badge({ children, tone = "red", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
