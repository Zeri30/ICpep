"use client";

/* Single-series line + area for change-over-time (registrations per month).
   2px line, soft area fill, ≥8px markers, and a hover crosshair+tooltip that
   reads the nearest point. One hue — the title names the series. */

import { useRef, useState } from "react";

export default function LineChart({
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const W = 600;
  const H = height;
  const padX = 16;
  const padTop = 20;
  const padBottom = 28;
  const max = Math.max(1, ...data);
  const n = data.length;

  const x = (i: number) => padX + (i * (W - padX * 2)) / Math.max(1, n - 1);
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);

  const points = data.map((v, i) => [x(i), y(v)] as const);
  const linePath = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px},${py}`).join(" ");
  const areaPath = `${linePath} L${x(n - 1)},${H - padBottom} L${x(0)},${H - padBottom} Z`;

  function onMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    for (let i = 1; i < n; i++) {
      if (Math.abs(x(i) - relX) < Math.abs(x(nearest) - relX)) nearest = i;
    }
    setHover(nearest);
  }

  return (
    <div ref={wrapRef} className="relative w-full" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill="url(#lc-fill)" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <line x1={x(hover)} y1={padTop - 8} x2={x(hover)} y2={H - padBottom} stroke={color} strokeOpacity="0.4" strokeWidth={1} />
        )}

        {points.map(([px, py], i) => (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={hover === i ? 5 : 3.5}
            fill={hover === i ? color : "#070707"}
            stroke={color}
            strokeWidth={2}
          />
        ))}
      </svg>

      <div className="mt-1 flex justify-between px-1">
        {labels.map((l, i) => (
          <span
            key={l}
            className={`font-head text-[10px] uppercase tracking-wide ${hover === i ? "text-foreground" : "text-muted-foreground"}`}
          >
            {l}
          </span>
        ))}
      </div>

      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-1 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}
        >
          <span className="font-semibold text-foreground">{data[hover]}</span>{" "}
          <span className="text-muted-foreground">new · {labels[hover]}</span>
        </div>
      )}
    </div>
  );
}
