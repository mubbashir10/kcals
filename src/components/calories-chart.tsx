"use client";

import { formatShortDateInTz, parseDayKey } from "@/lib/clock";

export type CaloriesPoint = {
  dayKey: string; // "YYYY-MM-DD"
  consumed: number;
  goal: number;
};

type Props = {
  points: CaloriesPoint[];
  timezone: string;
};

// Daily consumed kcal as thin bars; reference line at the (median) goal.
// Bars over goal are tinted rose, under goal are tinted emerald. Empty days
// (no food logged) are rendered as a faint tick.
export function CaloriesChart({ points, timezone }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/40 text-xs text-muted-foreground">
        No calories logged yet
      </div>
    );
  }

  const sorted = [...points].sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  const W = 800;
  const H = 220;
  const padX = 28;
  const padY = 30;
  const innerW = W - 2 * padX;
  const innerH = H - 2 * padY;

  // Y range: 0 → max(consumed, goal) with headroom
  const maxConsumed = Math.max(...sorted.map((p) => p.consumed));
  const maxGoal = Math.max(...sorted.map((p) => p.goal));
  const yMaxRaw = Math.max(maxConsumed, maxGoal);
  const yMax = Math.ceil((yMaxRaw * 1.15) / 100) * 100 || 100;

  const yAt = (kcal: number) => H - padY - (kcal / yMax) * innerH;

  // Bar geometry — give each day a slot, with a small gap.
  const slotW = innerW / sorted.length;
  const barW = Math.min(Math.max(slotW * 0.6, 2), 16);

  // Goal line — most days share the same goal, so just draw a line per
  // distinct goal segment. For now we draw a single dashed line at the
  // first day's goal (simplest), but render each bar's individual goal as
  // a tiny tick on top so retroactive goal changes show through.
  const firstGoal = sorted[0].goal;

  const dateFmt = (k: string) => formatShortDateInTz(dayKeyToNoonUtc(k), timezone);

  // Last 3 day labels at bottom — first, middle, last.
  const labels = [
    sorted[0],
    sorted[Math.floor(sorted.length / 2)],
    sorted[sorted.length - 1],
  ];

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{dateFmt(sorted[0].dayKey)}</span>
        <span>
          {sorted.length} {sorted.length === 1 ? "day" : "days"}
        </span>
        <span>{dateFmt(sorted[sorted.length - 1].dayKey)}</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
      >
        {/* y-axis labels */}
        <text
          x={4}
          y={padY}
          fontSize="10"
          opacity="0.5"
          className="fill-muted-foreground"
        >
          {yMax.toLocaleString()}
        </text>
        <text
          x={4}
          y={H - padY + 14}
          fontSize="10"
          opacity="0.5"
          className="fill-muted-foreground"
        >
          0
        </text>

        {/* Goal reference line (dashed) */}
        <line
          x1={padX}
          x2={W - padX}
          y1={yAt(firstGoal)}
          y2={yAt(firstGoal)}
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 4"
          className="text-muted-foreground/40"
        />
        <text
          x={W - padX}
          y={yAt(firstGoal) - 4}
          fontSize="10"
          textAnchor="end"
          className="fill-muted-foreground"
          opacity="0.7"
        >
          goal {firstGoal.toLocaleString()}
        </text>

        {/* Bars */}
        {sorted.map((p, i) => {
          const cx = padX + slotW * (i + 0.5);
          const x = cx - barW / 2;
          const y = yAt(p.consumed);
          const h = Math.max(H - padY - y, 0);
          const overGoal = p.goal > 0 && p.consumed > p.goal;
          const empty = p.consumed <= 0;
          if (empty) {
            return (
              <line
                key={p.dayKey}
                x1={cx}
                x2={cx}
                y1={H - padY - 2}
                y2={H - padY}
                stroke="currentColor"
                className="text-muted-foreground/30"
                strokeWidth="1.5"
              />
            );
          }
          return (
            <rect
              key={p.dayKey}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={Math.min(barW / 2, 2)}
              className={
                overGoal
                  ? "fill-rose-500/80"
                  : "fill-emerald-500/80"
              }
            />
          );
        })}

        {/* X-axis date labels */}
        {labels.map((p, i) => {
          const cx = padX + slotW * (sorted.indexOf(p) + 0.5);
          return (
            <text
              key={`${p.dayKey}-label-${i}`}
              x={cx}
              y={H - 6}
              fontSize="10"
              textAnchor="middle"
              className="fill-muted-foreground"
              opacity="0.6"
            >
              {dateFmt(p.dayKey)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// "2026-05-26" → Date at noon UTC (avoids tz edge cases for *labels only*).
function dayKeyToNoonUtc(key: string): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
