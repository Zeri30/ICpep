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
    <div className="relative overflow-hidden rounded-xl border border-line bg-card p-5">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />
      <div className="flex items-start justify-between gap-3">
        <p className="font-head text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <p className="mt-3 font-display text-3xl font-black tabular-nums text-foreground">{value}</p>
      {description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
