"use client";

/* Single-series vertical bars for a magnitude comparison (members per class).
   One hue — the bars are one measure, the x labels carry identity. Rounded
   data-ends anchored to the baseline, direct value labels (few bars), and a
   hover highlight. */

import { useState } from "react";

export default function BarChart({
  labels,
  data,
  color = "#dc2626",
  height = 220,
}: {
  labels: string[];
  data: number[];
  color?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data);
  const plotH = height - 34; // room for labels/values

  return (
    <div className="w-full">
      <div className="flex items-end gap-3" style={{ height: plotH + 22 }}>
        {data.map((v, i) => {
          const h = Math.round((v / max) * plotH);
          const active = hover === i;
          return (
            <div
              key={labels[i]}
              className="flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className={`mb-1.5 font-head text-xs font-semibold tabular-nums transition-opacity ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {v}
              </span>
              <div
                className="w-full max-w-[52px] rounded-t transition-[height,opacity] duration-300"
                style={{
                  height: Math.max(h, v > 0 ? 4 : 0),
                  background: color,
                  opacity: hover === null || active ? 1 : 0.45,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 border-t border-line/50 pt-2">
        {labels.map((l) => (
          <span key={l} className="flex-1 text-center font-head text-[11px] uppercase tracking-wide text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
