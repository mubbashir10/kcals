// Weekly summary — the week's days added up. Each day carries the figures its
// own page prints: what it ate, what it burned (BMR + active, milk included),
// the goal it was measured against, and what was left of that goal. The totals
// are those whole numbers summed, so the rows always add up to the top line.
//
// Two readings fall out, and `balance` picks between them by goal type:
//   • net energy balance (eaten − burned → predicted weight) for the goals
//     anchored to maintenance — lose, gain, maintain;
//   • under/over the goal for track, where the user chose the number and burn
//     plays no part (the same split EqDayBalance makes for a single day).
//
// Unlogged-day rule (the "be smart about missing data" choice): a day with no
// food logged is assumed eaten at maintenance (net 0), so it's excluded from
// the deficit/surplus. The week's net reflects ONLY days the user logged; we
// surface `loggedDays` of 7 so that's transparent.

import { db } from "@/lib/db";
import { dayKeyInTz, parseDayKey, startOfDayForDayKey } from "@/lib/clock";
import {
  FOOD_MEAL_DAY_SELECT,
  foodDayKey,
  foodsOfMealsInRange,
} from "@/lib/food-day";
import { shiftDayKey } from "@/lib/calendar-build";
import {
  ACTIVITY_BURN_SELECT,
  buildDailySnapshot,
  type DailySnapshotColumns,
} from "@/lib/daily-snapshot";
import { dayTargetsFor, resolveGoal } from "@/lib/day-energy";
import { KCAL_PER_KG, type GoalPace, type GoalType } from "@/lib/goal";
import { sumBy } from "@/lib/utils";

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
function netBalanceWord(net: number): "balanced" | "deficit" | "surplus" {
  if (net === 0) return "balanced";
  return net < 0 ? "deficit" : "surplus";
}

// Word for a week measured against its goal: positive = still under it.
function goalBalanceWord(
  remaining: number
): "on goal" | "under goal" | "over goal" {
  if (remaining === 0) return "on goal";
  return remaining > 0 ? "under goal" : "over goal";
}

// What the week's headline is measured against, resolved once here so every
// surface prints the same number with the same word. Track reads against the
// goal the user set — burn plays no part, the rule EqDayBalance applies to a
// day. The rest read as an energy balance, the one reading that predicts
// weight.
export type WeekBalance =
  | {
      against: "goal";
      kcal: number; // goal − consumed; negative = over the goal
      word: ReturnType<typeof goalBalanceWord>;
    }
  | {
      against: "maintenance";
      kcal: number; // consumed − burned; negative = deficit
      word: ReturnType<typeof netBalanceWord>;
    };

export type WeekDay = {
  dayKey: string;
  isToday: boolean;
  isFuture: boolean;
  hasFood: boolean;
  // Whole kcal — the figures the day's own page prints.
  consumedKcal: number;
  bmrKcal: number;
  // The day's burn, milk included — what it cost.
  tdeeKcal: number;
  // The effective target the day was measured against — the ring's number.
  goalKcal: number;
  // consumed − tdee; null on unlogged days (assumed maintenance).
  netKcal: number | null;
  // goal − consumed, as the day's equation printed it; null when unlogged.
  remainingKcal: number | null;
};

export type WeekSummary = {
  startKey: string;
  endKey: string;
  days: WeekDay[];
  loggedDays: number;
  // Totals over logged days only (the maintenance rule excludes the rest).
  consumedKcal: number;
  bmrKcal: number;
  burnedKcal: number;
  goalKcal: number;
  netKcal: number; // consumed − burned; negative = deficit
  remainingKcal: number; // goal − consumed; negative = over the goal
  // The headline: whichever of the two the goal type is measured by.
  balance: WeekBalance;
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
      where: foodsOfMealsInRange(userId, rangeStart, rangeEnd),
      select: { kcal: true, ...FOOD_MEAL_DAY_SELECT },
    }),
    db.activityLog.findMany({
      where: { userId, dayKey: { gte: startKey, lte: endKey } },
      select: { dayKey: true, ...ACTIVITY_BURN_SELECT },
    }),
  ]);

  const consumedByDay = new Map<string, number>();
  for (const f of foods) {
    const key = foodDayKey(tz, f);
    if (key < startKey || key > endKey) continue;
    consumedByDay.set(key, (consumedByDay.get(key) ?? 0) + f.kcal);
  }

  // Each day's stored burn — the pair the dashboard's ring counts down from. A
  // day without a snapshot row runs on the typical day buildDailySnapshot
  // computes from the current profile.
  const snapshotByDay = new Map<string, DailySnapshotColumns>();
  for (const a of activityLogs) {
    if (a.bmrKcal != null && a.tdeeKcal != null) {
      snapshotByDay.set(a.dayKey, { bmrKcal: a.bmrKcal, tdeeKcal: a.tdeeKcal });
    }
  }
  const typicalDay = buildDailySnapshot(profile, null).columns;

  // The derivation the day page runs — milk folded into the burn, the goal
  // applied on top — so a row here prints exactly what that day printed.
  const targetsForDay = dayTargetsFor(profile);
  const { goalType, goalPace, kcalOffset: dailyKcalOffset } = resolveGoal(profile);

  const days: WeekDay[] = dayKeys.map((dayKey) => {
    const hasFood = consumedByDay.has(dayKey);
    // Whole kcal per day, summed as such below: round the parts, not the sums,
    // and the rows add up to the totals to the kcal.
    const consumedKcal = Math.round(consumedByDay.get(dayKey) ?? 0);
    const snapshot = snapshotByDay.get(dayKey) ?? typicalDay;
    const targets = targetsForDay(snapshot.bmrKcal, snapshot.tdeeKcal);
    const bmrKcal = Math.round(targets.bmrKcal);
    const { tdeeKcal, calorieGoal: goalKcal } = targets;
    return {
      dayKey,
      isToday: dayKey === todayKey,
      isFuture: dayKey > todayKey,
      hasFood,
      consumedKcal,
      bmrKcal,
      tdeeKcal,
      goalKcal,
      netKcal: hasFood ? consumedKcal - tdeeKcal : null,
      remainingKcal: hasFood ? goalKcal - consumedKcal : null,
    };
  });

  const logged = days.filter((d) => d.hasFood);
  const consumedKcal = sumBy(logged, "consumedKcal");
  const bmrKcal = sumBy(logged, "bmrKcal");
  const burnedKcal = sumBy(logged, "tdeeKcal");
  const goalKcal = sumBy(logged, "goalKcal");
  const netKcal = consumedKcal - burnedKcal;
  const remainingKcal = goalKcal - consumedKcal;

  return {
    startKey,
    endKey,
    days,
    loggedDays: logged.length,
    consumedKcal,
    bmrKcal,
    burnedKcal,
    goalKcal,
    netKcal,
    remainingKcal,
    balance:
      goalType === "track"
        ? { against: "goal", kcal: remainingKcal, word: goalBalanceWord(remainingKcal) }
        : { against: "maintenance", kcal: netKcal, word: netBalanceWord(netKcal) },
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
