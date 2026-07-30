"use client";

import type { LucideIcon } from "lucide-react";

export type StatTone = "primary" | "info" | "success" | "warning";

const toneColor: Record<StatTone, string> = {
  primary: "#dc2626",
  info: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
};

/** A single KPI tile — parity for one Filament stat. */
export default function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  tone?: StatTone;
}) {
  const accent = toneColor[tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-line bg-card p-5 transition-colors hover:border-white/15">
      {/* Ambient corner glow instead of a flat accent bar — echoes the crimson
          glow used across the site rather than a stock "colored stripe" tile. */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-2xl"
        style={{ background: accent, opacity: 0.16 }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon size={16} />
        </span>
      </div>
      <p className="relative mt-3 font-display text-3xl font-black tabular-nums text-foreground">{value}</p>
      {description && <p className="relative mt-1.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
