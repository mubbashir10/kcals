// Weight series math: a smoothed trend (EWMA) that filters day-to-day water
// noise, and an energy-balance "expected" weight projected from logged
// calories. All weights in kg; callers convert for display.

import { dayKeyToLocalDate } from "@/lib/clock";
import { KCAL_PER_KG } from "@/lib/goal";

export type WeightPoint = { date: string; weightKg: number };

// Exponential smoothing factor. 0.1 ≈ the Hacker's Diet / Libra default: each
// day's trend moves 10% of the way toward that day's scale reading, so a
// one-off water spike barely budges it while a real change pulls it over ~1–2
// weeks.
const DEFAULT_ALPHA = 0.1;

// Collapse possibly-multiple weigh-ins per day to one value per day — the last
// reading of the day. `logs` MUST be in chronological order so "last wins".
export function dailyWeights(
  logs: { dayKey: string; weightKg: number }[]
): { dayKey: string; weightKg: number }[] {
  const byDay = new Map<string, number>();
  for (const l of logs) byDay.set(l.dayKey, l.weightKg);
  return [...byDay.entries()]
    .map(([dayKey, weightKg]) => ({ dayKey, weightKg }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

// EWMA over a chronological daily series. Seeds the trend at the first reading
// so the line starts on the scale rather than ramping up from zero.
export function trendSeries(
  daily: { dayKey: string; weightKg: number }[],
  alpha: number = DEFAULT_ALPHA
): WeightPoint[] {
  let trend = 0;
  return daily.map((d, i) => {
    trend = i === 0 ? d.weightKg : trend + alpha * (d.weightKg - trend);
    return { date: dayKeyToLocalDate(d.dayKey).toISOString(), weightKg: trend };
  });
}

// Project weight forward from a known weigh-in using daily energy balance:
// each logged day's (consumed − maintenance) kcal, accumulated and converted
// at 7700 kcal/kg. Only days strictly after the anchor contribute, and only
// days the caller includes (logged days) — unlogged days are treated as
// neutral, which is the honest "based on what you logged" reading.
export function expectedSeries(opts: {
  anchorDayKey: string;
  anchorWeightKg: number;
  netByDay: { dayKey: string; netKcal: number }[];
}): WeightPoint[] {
  const out: WeightPoint[] = [
    {
      date: dayKeyToLocalDate(opts.anchorDayKey).toISOString(),
      weightKg: opts.anchorWeightKg,
    },
  ];
  let cumKcal = 0;
  for (const d of opts.netByDay) {
    if (d.dayKey <= opts.anchorDayKey) continue;
    cumKcal += d.netKcal;
    out.push({
      date: dayKeyToLocalDate(d.dayKey).toISOString(),
      weightKg: opts.anchorWeightKg + cumKcal / KCAL_PER_KG,
    });
  }
  return out;
}
