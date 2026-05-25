"use client";

import { kgToLb } from "@/lib/bmr";
import { formatShortDateInTz } from "@/lib/clock";

export type WeightPoint = { date: string; weightKg: number };

type Props = {
  points: WeightPoint[];
  units: "metric" | "imperial";
  timezone: string;
};

export function WeightChart({ points, units, timezone }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 text-xs text-muted-foreground">
        No weigh-ins yet
      </div>
    );
  }

  const sorted = [...points].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const display = (kg: number) => (units === "imperial" ? kgToLb(kg) : kg);
  const unitLabel = units === "imperial" ? "lb" : "kg";

  const W = 800;
  const H = 220;
  const padX = 24;
  const padY = 28;

  const tMin = new Date(sorted[0].date).getTime();
  const tMax = new Date(sorted[sorted.length - 1].date).getTime();
  const tSpan = Math.max(tMax - tMin, 1);

  const weights = sorted.map((p) => p.weightKg);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const wPad = (wMax - wMin) * 0.15 || 0.5;
  const yMin = wMin - wPad;
  const yMax = wMax + wPad;

  const xAt = (iso: string) =>
    padX + ((new Date(iso).getTime() - tMin) / tSpan) * (W - 2 * padX);
  const yAt = (kg: number) =>
    H - padY - ((kg - yMin) / (yMax - yMin || 1)) * (H - 2 * padY);

  // Build line path
  const linePath = sorted
    .map(
      (p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.date).toFixed(2)} ${yAt(p.weightKg).toFixed(2)}`
    )
    .join(" ");

  // Build filled area path
  const areaPath =
    sorted.length > 1
      ? `${linePath} L ${xAt(sorted[sorted.length - 1].date).toFixed(2)} ${
          H - padY
        } L ${xAt(sorted[0].date).toFixed(2)} ${H - padY} Z`
      : "";

  const dateFmt = (iso: string) => formatShortDateInTz(iso, timezone);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{dateFmt(sorted[0].date)}</span>
        <span>{points.length} weigh-ins</span>
        <span>{dateFmt(sorted[sorted.length - 1].date)}</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
      >
        <defs>
          <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="oklch(0.65 0.22 25)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y-axis reference labels */}
        <text
          x={4}
          y={padY}
          fill="currentColor"
          fontSize="10"
          opacity="0.5"
          className="fill-muted-foreground"
        >
          {display(yMax).toFixed(1)}
          {unitLabel}
        </text>
        <text
          x={4}
          y={H - padY + 14}
          fill="currentColor"
          fontSize="10"
          opacity="0.5"
          className="fill-muted-foreground"
        >
          {display(yMin).toFixed(1)}
          {unitLabel}
        </text>

        {areaPath && <path d={areaPath} fill="url(#weightFill)" />}
        <path
          d={linePath}
          fill="none"
          stroke="oklch(0.65 0.22 25)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {sorted.map((p, i) => (
          <circle
            key={`${p.date}-${i}`}
            cx={xAt(p.date)}
            cy={yAt(p.weightKg)}
            r={i === sorted.length - 1 ? 4 : 2.5}
            fill="oklch(0.65 0.22 25)"
            stroke="var(--card)"
            strokeWidth="1.5"
          />
        ))}
      </svg>
    </div>
  );
}
