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
 * figure, bigger icon accent — for the one or two numbers that should
 * visually anchor the dashboard; every other tile stays the original compact
 * size so supporting figures don't compete with them.
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
      {/* Tone-colored wash, strongest at the right edge and fading out toward
          the left, so the white icon reads as sitting on top of it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-3/4"
        style={{ background: `linear-gradient(to left, ${accent}3d, transparent)` }}
      />

      {/* Oversized icon on the right, a soft white watermark accent rather
          than a stock colored-chip icon. */}
      <Icon
        aria-hidden
        strokeWidth={1.25}
        size={lg ? 148 : 108}
        style={{
          color: "#ffffff",
          opacity: 0.25,
          position: "absolute",
          top: "50%",
          right: lg ? "1rem" : "0.75rem",
          left: "auto",
          transform: "translateY(-50%)",
        }}
        className="pointer-events-none"
      />

      <p
        className={`relative font-head font-semibold uppercase tracking-widest text-muted-foreground ${
          lg ? "text-xs" : "text-[11px]"
        }`}
      >
        {label}
      </p>
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
