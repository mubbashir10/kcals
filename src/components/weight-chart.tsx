"use client";

import { kgToLb, type Units } from "@/lib/bmr";
import { formatShortDateInTz } from "@/lib/clock";
import type { WeightPoint } from "@/lib/weight-trend";

type Props = {
  /** Raw scale weigh-ins (one per logged entry). */
  scale: WeightPoint[];
  /** Smoothed EWMA trend, one per day. */
  trend?: WeightPoint[];
  /** Energy-balance projection from logged calories. */
  expected?: WeightPoint[];
  units: Units;
  timezone: string;
};

const SCALE_COLOR = "oklch(0.65 0.22 25)"; // brand rose — raw readings
const TREND_COLOR = "oklch(0.55 0.2 25)"; // deeper rose — the hero line
const EXPECTED_COLOR = "oklch(0.62 0.15 255)"; // blue — projection

const W = 800;
const H = 220;
const PAD_X = 24;
const PAD_Y = 28;

export function WeightChart({ scale, trend, expected, units, timezone }: Props) {
  if (scale.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 text-xs text-muted-foreground">
        No weigh-ins yet
      </div>
    );
  }

  const sortByDate = (pts: WeightPoint[]) =>
    [...pts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const scaleS = sortByDate(scale);
  const trendS = trend && trend.length > 0 ? sortByDate(trend) : null;
  // Need 2+ points to draw a projection — a lone anchor isn't a line.
  const expectedS = expected && expected.length > 1 ? sortByDate(expected) : null;

  // Domain spans every series so no line gets clipped (expected can run past
  // the last weigh-in).
  const all = [...scaleS, ...(trendS ?? []), ...(expectedS ?? [])];
  const times = all.map((p) => new Date(p.date).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = Math.max(tMax - tMin, 1);

  const weights = all.map((p) => p.weightKg);
  const wMin = Math.min(...weights);
  const wMax = Math.max(...weights);
  const wPad = (wMax - wMin) * 0.15 || 0.5;
  const yMin = wMin - wPad;
  const yMax = wMax + wPad;

  const display = (kg: number) => (units === "imperial" ? kgToLb(kg) : kg);
  const unitLabel = units === "imperial" ? "lb" : "kg";

  const xAt = (iso: string) =>
    PAD_X + ((new Date(iso).getTime() - tMin) / tSpan) * (W - 2 * PAD_X);
  const yAt = (kg: number) =>
    H - PAD_Y - ((kg - yMin) / (yMax - yMin || 1)) * (H - 2 * PAD_Y);

  const linePath = (pts: WeightPoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.date).toFixed(2)} ${yAt(p.weightKg).toFixed(2)}`)
      .join(" ");

  const dateFmt = (iso: string) => formatShortDateInTz(iso, timezone);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>{dateFmt(scaleS[0].date)}</span>
        <span>{scale.length} weigh-ins</span>
        <span>{dateFmt(scaleS[scaleS.length - 1].date)}</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-48 w-full">
        {/* Y-axis reference labels */}
        <text x={4} y={PAD_Y} fontSize="10" opacity="0.5" className="fill-muted-foreground">
          {display(yMax).toFixed(1)}
          {unitLabel}
        </text>
        <text
          x={4}
          y={H - PAD_Y + 14}
          fontSize="10"
          opacity="0.5"
          className="fill-muted-foreground"
        >
          {display(yMin).toFixed(1)}
          {unitLabel}
        </text>

        {/* Expected (energy-balance) — dashed, behind the others. */}
        {expectedS && (
          <path
            d={linePath(expectedS)}
            fill="none"
            stroke={EXPECTED_COLOR}
            strokeWidth="2"
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Scale — faint dots only (no connecting line: it's the noise). */}
        {scaleS.map((p, i) => (
          <circle
            key={`s-${p.date}-${i}`}
            cx={xAt(p.date)}
            cy={yAt(p.weightKg)}
            r={2}
            fill={SCALE_COLOR}
            opacity={trendS ? 0.32 : 1}
          />
        ))}

        {/* Trend — the hero line. */}
        {trendS && (
          <path
            d={linePath(trendS)}
            fill="none"
            stroke={TREND_COLOR}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>

      <Legend hasTrend={!!trendS} hasExpected={!!expectedS} />
    </div>
  );
}

function Legend({ hasTrend, hasExpected }: { hasTrend: boolean; hasExpected: boolean }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: SCALE_COLOR }} />
        Scale
      </span>
      {hasTrend && (
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: TREND_COLOR }} />
          Trend
        </span>
      )}
      {hasExpected && (
        <span className="flex items-center gap-1.5">
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: EXPECTED_COLOR }}
          />
          Expected
        </span>
      )}
    </div>
  );
}
