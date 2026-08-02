// Everything-for-one-day: consumed macros, the day's BMR/Active/TDEE, the
// effective calorie + macro targets, steps/activity, and the day's weight.
// Shared by the /day/[date] page and the /calendar day summary so both read
// the same numbers. BMR/TDEE prefer the day's stored ActivityLog snapshot and
// fall back to the current profile (same compromise as daily-history.ts).

import { db } from "@/lib/db";
import type { BmrResult } from "@/lib/bmr";
import { dayKeyInTz, startOfDayForDayKey } from "@/lib/clock";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import { normalizeMealSort } from "@/lib/widget-order";
import { computeDayTargets } from "@/lib/day-energy";
import type { GoalPace, GoalType } from "@/lib/goal";
import type { MacroGoals } from "@/lib/macros";
import type { ActiveResult, ActivityMode } from "@/lib/tdee";
import { sumBy } from "@/lib/utils";
import { weekAgoFrom, weightDelta7dKg } from "@/lib/weight";

type LoadedProfile = NonNullable<
  Awaited<ReturnType<typeof db.profile.findUnique>>
>;

type DayMeal = Awaited<ReturnType<typeof db.meal.findMany>>[number] & {
  foods: Awaited<ReturnType<typeof db.food.findMany>>;
};
type DayActivityLog = Awaited<ReturnType<typeof db.activityLog.findUnique>>;

export type DayDetail = {
  dayKey: string;
  /** Real meals (with foods) logged this day, in the user's sort order. */
  meals: DayMeal[];
  activityLog: DayActivityLog;
  consumed: { kcal: number; protein: number; carbs: number; fat: number };
  foodCount: number;
  calorieGoal: number;
  macroGoals: MacroGoals;
  bmrKcal: number;
  tdeeKcal: number;
  /** Active (exercise/NEAT) kcal for this specific day. */
  activeKcal: number;
  /** That day's latest weigh-in (for the /calendar day summary). */
  weight: { id: number; weightKg: number } | null;
  hasActivity: boolean;

  // Dashboard extras — the fuller picture the home + day pages render.
  bmr: BmrResult;
  active: ActiveResult;
  goalType: GoalType;
  goalPace: GoalPace | null;
  kcalOffset: number;
  lactationKcal: number;
  /** Latest weigh-in overall + 7-day trend (a body-metric, day-independent). */
  latestWeight: { weightKg: number; loggedAt: Date } | null;
  delta7dKg: number | null;
};

export async function loadDayDetail(
  userId: string,
  profile: LoadedProfile,
  dayKey: string
): Promise<DayDetail> {
  const tz = profile.timezone || "UTC";
  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const weekAgo = weekAgoFrom(new Date());
  const [meals, activityLog, weightLogs, latestWeightLog, baselineWeightRaw] =
    await Promise.all([
      db.meal.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { loggedAt: normalizeMealSort(profile.mealSortDir) },
        include: { foods: { orderBy: { loggedAt: "asc" } } },
      }),
      db.activityLog.findUnique({
        where: { userId_dayKey: { userId, dayKey } },
      }),
      db.weightLog.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
        orderBy: { loggedAt: "asc" },
      }),
      db.weightLog.findFirst({ where: { userId }, orderBy: { loggedAt: "desc" } }),
      db.weightLog.findFirst({
        where: { userId, loggedAt: { lte: weekAgo } },
        orderBy: { loggedAt: "desc" },
      }),
    ]);

  const allFoods = meals.flatMap((m) => m.foods);
  const consumed = {
    kcal: sumBy(allFoods, "kcal"),
    protein: sumBy(allFoods, "proteinG"),
    carbs: sumBy(allFoods, "carbsG"),
    fat: sumBy(allFoods, "fatG"),
  };

  // The same snapshot the write path builds. It picks override-vs-typical-day
  // once, so the active breakdown shown here always sums to the TDEE beside it
  // — a row that exists but is empty (the dashboard creates one per user per
  // day) would otherwise display "NEAT 0" against a TDEE that includes it.
  const snapshot = buildDailySnapshot(
    profile,
    activityLog
      ? {
          mode: activityLog.mode as ActivityMode,
          steps: activityLog.steps,
          liftingMin: activityLog.liftingMin,
          cardioMin: activityLog.cardioMin,
          wearableKcal: activityLog.wearableKcal,
        }
      : null,
    { inProgress: dayKey === dayKeyInTz(tz) }
  );

  // A past day keeps the BMR/TDEE stored with it; the fresh estimate is only
  // for rows written before those columns existed.
  const targets = computeDayTargets({
    bmrKcal: activityLog?.bmrKcal ?? snapshot.columns.bmrKcal,
    baseTdeeKcal: activityLog?.tdeeKcal ?? snapshot.columns.tdeeKcal,
    profile,
  });

  const dayWeight = weightLogs.at(-1) ?? null;

  return {
    dayKey,
    meals,
    activityLog,
    consumed,
    foodCount: allFoods.length,
    calorieGoal: targets.calorieGoal,
    macroGoals: targets.macroGoals,
    bmrKcal: targets.bmrKcal,
    tdeeKcal: targets.tdeeKcal,
    activeKcal: snapshot.active.kcal,
    weight: dayWeight ? { id: dayWeight.id, weightKg: dayWeight.weightKg } : null,
    hasActivity:
      activityLog != null &&
      ((activityLog.steps ?? 0) > 0 ||
        (activityLog.liftingMin ?? 0) > 0 ||
        (activityLog.cardioMin ?? 0) > 0 ||
        (activityLog.wearableKcal ?? 0) > 0),
    // Stored kcal for the day, with the formula/LBM of the compute that would
    // produce it — the same BmrResult shape the dashboard renders.
    bmr: { ...snapshot.bmr, kcal: targets.bmrKcal },
    active: snapshot.active,
    goalType: targets.goalType,
    goalPace: targets.goalPace,
    kcalOffset: targets.kcalOffset,
    lactationKcal: targets.lactationKcal,
    latestWeight: latestWeightLog
      ? { weightKg: latestWeightLog.weightKg, loggedAt: latestWeightLog.loggedAt }
      : null,
    delta7dKg: weightDelta7dKg(latestWeightLog, baselineWeightRaw),
  };
}
