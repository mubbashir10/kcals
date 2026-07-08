"use client";

import { useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { displayWeight, type Units } from "@/lib/bmr";
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
const GRID_COLOR = "oklch(0.7 0.01 95 / 0.12)";
const AXIS_COLOR = "oklch(0.7 0.01 95 / 0.55)";

const DAY_MS = 24 * 60 * 60 * 1000;

// A single merged row on the time axis. Lines connect across the nulls, so a
// day with only a scale reading still places its trend/expected from the
// nearest day they exist.
type Row = {
  t: number;
  scale: number | null;
  trend: number | null;
  expected: number | null;
};
type SeriesKey = "scale" | "trend" | "expected";

// `null` days marks the whole-range chip; finite values are day spans.
const PRESETS: { label: string; days: number | null }[] = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
];

export function WeightChart({ scale, trend, expected, units, timezone }: Props) {
  // Merge all three series onto one sorted time axis. Same ms → same row, so
  // the trend/expected for a day line up with that day's scale reading.
  const data = useMemo<Row[]>(() => {
    const byTime = new Map<number, Row>();
    const put = (pts: WeightPoint[] | undefined, key: SeriesKey) => {
      if (!pts) return;
      for (const p of pts) {
        const t = new Date(p.date).getTime();
        if (!Number.isFinite(t)) continue;
        const row = byTime.get(t) ?? { t, scale: null, trend: null, expected: null };
        row[key] = p.weightKg;
        byTime.set(t, row);
      }
    };
    put(scale, "scale");
    put(trend, "trend");
    // A lone expected anchor isn't a line — drop it.
    if (expected && expected.length > 1) put(expected, "expected");
    return [...byTime.values()].sort((a, b) => a.t - b.t);
  }, [scale, trend, expected]);

  // Visible window as [startIndex, endIndex] into `data`; the Brush owns it and
  // presets jump it. The label of the last-applied preset (or null after a
  // manual drag) drives the active chip — derived matching was too fragile.
  const [range, setRange] = useState<[number, number] | null>(null);
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

  // Clamp indices on read: `data` can shrink/reindex when props change (a new
  // weigh-in lands), and a stale `range` would otherwise index out of bounds.
  const lastIdx = Math.max(0, data.length - 1);
  let start = range ? Math.min(Math.max(range[0], 0), lastIdx) : 0;
  let end = range ? Math.min(Math.max(range[1], 0), lastIdx) : lastIdx;
  if (start > end) [start, end] = [0, lastIdx];

  // Y domain + weigh-in count from the *visible* slice only, in one pass — so
  // zooming in magnifies the wobble instead of leaving the line pinned flat,
  // and the rapid re-renders during a Brush drag stay cheap.
  const { yDomain, scaleCount } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    let count = 0;
    for (let i = start; i <= end; i++) {
      const r = data[i];
      if (!r) continue;
      for (const v of [r.scale, r.trend, r.expected]) {
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (r.scale != null) count++;
    }
    if (!Number.isFinite(min)) {
      min = data[0]?.scale ?? 0;
      max = min + 1;
    }
    const pad = (max - min) * 0.08 || 0.5;
    return { yDomain: [min - pad, max + pad] as [number, number], scaleCount: count };
  }, [data, start, end]);

  if (scale.length === 0 || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 text-xs text-muted-foreground">
        No weigh-ins yet
      </div>
    );
  }

  const tMin = data[0].t;
  const tMax = data[lastIdx].t;
  const isAll = start === 0 && end === lastIdx;
  const activePreset = appliedPreset ?? (isAll ? "All" : null);

  const applyPreset = (label: string, days: number | null) => {
    setAppliedPreset(label);
    if (days == null) {
      setRange([0, lastIdx]);
      return;
    }
    const cutoff = tMax - days * DAY_MS;
    const s = data.findIndex((r) => r.t >= cutoff);
    setRange([s < 0 ? 0 : s, lastIdx]);
  };

  const fullSpanDays = (tMax - tMin) / DAY_MS;
  const fmtTick = (t: number) => formatShortDateInTz(new Date(t), timezone);
  const fmtFull = (t: number) =>
    new Date(t).toLocaleDateString("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      year: fullSpanDays > 300 ? "numeric" : undefined,
    });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-medium tabular-nums text-foreground/80">
            {fmtTick(data[start].t)} – {fmtTick(data[end].t)}
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {scaleCount} {scaleCount === 1 ? "weigh-in" : "weigh-ins"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {PRESETS.map((p) => {
            // Hide presets longer than the data we have (keep "All").
            if (p.days != null && p.days > fullSpanDays * 1.1) return null;
            const active = activePreset === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.label, p.days)}
                aria-pressed={active}
                className={
                  "rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors " +
                  (active
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground")
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="-mx-1 h-56 w-[calc(100%+0.5rem)] touch-pan-y select-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtTick}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
              minTickGap={48}
              tickMargin={8}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={(v: number) => displayWeight(v, units).value}
              tick={{ fontSize: 10, fill: AXIS_COLOR }}
              tickLine={false}
              axisLine={false}
              width={34}
              tickCount={5}
            />
            <Tooltip
              cursor={{ stroke: AXIS_COLOR, strokeWidth: 1, strokeDasharray: "3 3" }}
              isAnimationActive={false}
              content={<ChartTooltip units={units} fmtFull={fmtFull} />}
            />

            {/* Expected (energy-balance) — dashed, behind the others. */}
            <Line
              dataKey="expected"
              type="monotone"
              stroke={EXPECTED_COLOR}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            {/* Scale — faint dots only (the raw noise), no connecting line. */}
            <Line
              dataKey="scale"
              stroke="transparent"
              strokeWidth={0}
              dot={{ r: 1.7, fill: SCALE_COLOR, fillOpacity: trend ? 0.34 : 0.9, strokeWidth: 0 }}
              activeDot={{ r: 3.5, fill: SCALE_COLOR, strokeWidth: 0 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Trend — the hero line. */}
            <Line
              dataKey="trend"
              type="monotone"
              stroke={TREND_COLOR}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: TREND_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />

            <Brush
              dataKey="t"
              height={28}
              travellerWidth={8}
              gap={1}
              stroke={TREND_COLOR}
              fill="oklch(0.7 0.01 95 / 0.06)"
              tickFormatter={fmtTick}
              startIndex={start}
              endIndex={end}
              onChange={(r) => {
                const s = r?.startIndex;
                const e = r?.endIndex;
                if (typeof s !== "number" || typeof e !== "number") return;
                setAppliedPreset(null);
                // Bail on no-op fires (Recharts emits these mid-drag) so the
                // whole chart doesn't re-render for an unchanged window.
                setRange((prev) => (prev && prev[0] === s && prev[1] === e ? prev : [s, e]));
              }}
            >
              {/* Panorama preview inside the navigator. */}
              <ComposedChart>
                <Line
                  dataKey="trend"
                  type="monotone"
                  stroke={TREND_COLOR}
                  strokeWidth={1}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <Legend hasTrend={!!trend} hasExpected={!!(expected && expected.length > 1)} />
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  units,
  fmtFull,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | null }>;
  label?: number;
  units: Units;
  fmtFull: (t: number) => string;
}) {
  if (!active || !payload || payload.length === 0 || label == null) return null;

  const val = (key: string) => payload.find((p) => p.dataKey === key)?.value ?? null;

  const rows = [
    { key: "scale", label: "Scale", color: SCALE_COLOR, value: val("scale") },
    { key: "trend", label: "Trend", color: TREND_COLOR, value: val("trend") },
    { key: "expected", label: "Expected", color: EXPECTED_COLOR, value: val("expected") },
  ].filter((r): r is typeof r & { value: number } => r.value != null);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur-sm">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {fmtFull(label)}
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => {
          const w = displayWeight(r.value, units);
          return (
            <div key={r.key} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="font-semibold tabular-nums">
                {w.value}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                  {w.unit}
                </span>
              </span>
            </div>
          );
        })}
      </div>
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
