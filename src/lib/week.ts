// Weekly summary — aggregates 7 consecutive days into consumed / burned / net,
// then turns that energy balance into a predicted weight change.
//
// Unlogged-day rule (the "be smart about missing data" choice): a day with no
// food logged is assumed eaten at maintenance (net 0), so it's excluded from
// the deficit/surplus. The week's net reflects ONLY days the user logged; we
// surface `loggedDays` of 7 so that's transparent.

import { db } from "@/lib/db";
import { dayKeyInTz, parseDayKey, startOfDayForDayKey } from "@/lib/clock";
import { shiftDayKey } from "@/lib/calendar-build";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import {
  KCAL_PER_KG,
  computeKcalOffset,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";

const DAY_MS = 86_400_000;

// Weekday index, 0=Sunday … 6=Saturday (JS getUTCDay convention).
export type WeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_WEEK_START_DAY: WeekStartDay = 1; // Monday — matches the schema default

// Full profile row, as loaded by requireProfile / db.profile.findUnique.
type LoadedProfile = NonNullable<Awaited<ReturnType<typeof db.profile.findUnique>>>;

// Weekday (0=Sun..6=Sat) of a dayKey. The key already encodes a local calendar
// day, so a plain UTC date gives the right weekday without any tz math.
export function weekdayOfDayKey(dayKey: string): number {
  const { year, month, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// The week-start dayKey of the week containing `dayKey`, given which weekday
// the user's week begins on.
export function weekStartKeyFor(dayKey: string, weekStartDay: number): string {
  const offset = (weekdayOfDayKey(dayKey) - weekStartDay + 7) % 7;
  return shiftDayKey(dayKey, -offset);
}

// The 7 dayKeys of the week starting at `startKey`.
export function weekDayKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(startKey, i));
}

// Word for a net energy balance: negative = deficit, positive = surplus.
export function netBalanceWord(net: number): "balanced" | "deficit" | "surplus" {
  if (net === 0) return "balanced";
  return net < 0 ? "deficit" : "surplus";
}

export type WeekDay = {
  dayKey: string;
  isToday: boolean;
  isFuture: boolean;
  hasFood: boolean;
  consumedKcal: number;
  tdeeKcal: number;
  // consumed − tdee; null on unlogged days (assumed maintenance).
  netKcal: number | null;
};

export type WeekSummary = {
  startKey: string;
  endKey: string;
  days: WeekDay[];
  loggedDays: number;
  // Totals over logged days only (the maintenance rule excludes the rest).
  consumedKcal: number;
  burnedKcal: number;
  netKcal: number; // consumed − burned; negative = deficit
  // Energy balance → weight: net ÷ 7700. Negative = predicted loss.
  predictedWeightKg: number;
  // Goal context.
  goalType: GoalType;
  goalPace: GoalPace | null;
  dailyKcalOffset: number; // signed per-day target (loss < 0, gain > 0)
  targetNetKcal: number; // dailyKcalOffset × loggedDays
  // Navigation.
  isCurrentWeek: boolean;
  canGoNext: boolean;
  prevStartKey: string;
  nextStartKey: string;
};

export async function loadWeekSummary(
  userId: string,
  profile: LoadedProfile,
  weekParam?: string | null,
  now: Date = new Date()
): Promise<WeekSummary> {
  const tz = profile.timezone || "UTC";
  const weekStartDay = profile.weekStartDay ?? DEFAULT_WEEK_START_DAY;

  const todayKey = dayKeyInTz(tz, now);
  const currentStart = weekStartKeyFor(todayKey, weekStartDay);

  // Snap any requested dayKey to its week start; default to the current week.
  // Never resolve to a future week.
  const requested = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? "")
    ? weekStartKeyFor(weekParam as string, weekStartDay)
    : currentStart;
  const startKey = requested > currentStart ? currentStart : requested;
  const endKey = shiftDayKey(startKey, 6);
  const dayKeys = weekDayKeys(startKey);

  // Fetch the window. Pad the UTC bounds by a day on each side (a tz-day can
  // straddle UTC midnight); we filter precisely by tz dayKey below.
  const rangeStart = new Date(startOfDayForDayKey(tz, startKey).getTime() - DAY_MS);
  const rangeEnd = new Date(startOfDayForDayKey(tz, endKey).getTime() + 2 * DAY_MS);

  const [foods, activityLogs] = await Promise.all([
    db.food.findMany({
      where: { meal: { userId }, loggedAt: { gte: rangeStart, lt: rangeEnd } },
      select: { kcal: true, loggedAt: true },
    }),
    db.activityLog.findMany({
      where: { userId, dayKey: { gte: startKey, lte: endKey } },
      select: { dayKey: true, tdeeKcal: true },
    }),
  ]);

  const consumedByDay = new Map<string, number>();
  for (const f of foods) {
    const key = dayKeyInTz(tz, f.loggedAt);
    if (key < startKey || key > endKey) continue;
    consumedByDay.set(key, (consumedByDay.get(key) ?? 0) + f.kcal);
  }
  const tdeeByDay = new Map<string, number>();
  for (const a of activityLogs) {
    if (a.tdeeKcal != null) tdeeByDay.set(a.dayKey, a.tdeeKcal);
  }

  // Fallback TDEE for days without a snapshot row — the same "typical day"
  // estimate buildDailySnapshot computes from the current profile.
  const fallbackTdee = buildDailySnapshot(profile, null).tdeeKcal;

  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  const dailyKcalOffset = computeKcalOffset(goalType, goalPace);

  const days: WeekDay[] = dayKeys.map((dayKey) => {
    const hasFood = consumedByDay.has(dayKey);
    const consumedKcal = consumedByDay.get(dayKey) ?? 0;
    const tdeeKcal = tdeeByDay.get(dayKey) ?? fallbackTdee;
    return {
      dayKey,
      isToday: dayKey === todayKey,
      isFuture: dayKey > todayKey,
      hasFood,
      consumedKcal,
      tdeeKcal,
      netKcal: hasFood ? consumedKcal - tdeeKcal : null,
    };
  });

  const logged = days.filter((d) => d.hasFood);
  const consumedKcal = logged.reduce((a, d) => a + d.consumedKcal, 0);
  const burnedKcal = logged.reduce((a, d) => a + d.tdeeKcal, 0);
  const netKcal = consumedKcal - burnedKcal;

  return {
    startKey,
    endKey,
    days,
    loggedDays: logged.length,
    consumedKcal,
    burnedKcal,
    netKcal,
    predictedWeightKg: netKcal / KCAL_PER_KG,
    goalType,
    goalPace,
    dailyKcalOffset,
    targetNetKcal: dailyKcalOffset * logged.length,
    isCurrentWeek: startKey === currentStart,
    canGoNext: shiftDayKey(startKey, 7) <= currentStart,
    prevStartKey: shiftDayKey(startKey, -7),
    nextStartKey: shiftDayKey(startKey, 7),
  };
}
