"use client";

import type { LucideIcon } from "lucide-react";

export type StatTone = "primary" | "info" | "success" | "warning";

const toneColor: Record<StatTone, string> = {
  primary: "#dc2626",
  info: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
};

/**
 * A single KPI tile. `size="lg"` is the Mission Control hero variant — bigger
 * figure, bigger icon, a stronger corner glow — for the one or two numbers
 * that should visually anchor the dashboard; every other tile stays the
 * original compact size so supporting figures don't compete with them.
 */
export default function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  size = "md",
  className = "",
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: StatTone;
  size?: "md" | "lg";
  className?: string;
}) {
  const accent = toneColor[tone];
  const lg = size === "lg";

  return (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-card transition-colors hover:border-white/15 ${
        lg ? "p-6" : "p-5"
      } ${className}`}
    >
      {/* Ambient corner glow instead of a flat accent bar — echoes the crimson
          glow used across the site rather than a stock "colored stripe" tile.
          Stronger and wider on hero tiles, so the glow itself is part of what
          reads as "more important" at a glance. */}
      <div
        className={`pointer-events-none absolute -right-8 -top-8 rounded-full blur-2xl ${lg ? "size-40" : "size-28"}`}
        style={{ background: accent, opacity: lg ? 0.22 : 0.16 }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p
          className={`font-head font-semibold uppercase tracking-widest text-muted-foreground ${
            lg ? "text-xs" : "text-[11px]"
          }`}
        >
          {label}
        </p>
        <span
          className={`flex shrink-0 items-center justify-center rounded-lg ${lg ? "size-11" : "size-9"}`}
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon size={lg ? 20 : 16} />
        </span>
      </div>
      <p
        className={`relative font-display font-black tabular-nums text-foreground ${
          lg ? "mt-4 text-4xl sm:text-5xl" : "mt-3 text-3xl"
        }`}
      >
        {value}
      </p>
      {description && <p className="relative mt-auto pt-1.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
