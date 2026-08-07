// Everything-for-one-day: consumed macros, the day's BMR/Active/TDEE, the
// effective calorie + macro targets, steps/activity, and the day's weight.
// Shared by the /day/[date] page and the /calendar day summary so both read
// the same numbers. BMR/TDEE prefer the day's stored ActivityLog snapshot and
// fall back to the current profile (same compromise as daily-history.ts).

import { db } from "@/lib/db";
import type { BmrResult } from "@/lib/bmr";
import { startOfDayForDayKey } from "@/lib/clock";
import { buildDailySnapshot, dayHasOwnActivity } from "@/lib/daily-snapshot";
import { normalizeMealSort } from "@/lib/widget-order";
import { computeDayTargets } from "@/lib/day-energy";
import { healthSourceIcon } from "@/lib/health-sync";
import type { GoalPace, GoalType } from "@/lib/goal";
import type { MacroGoals } from "@/lib/macros";
import type { ActiveResult } from "@/lib/tdee";
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
  /** Launcher icon of the app that synced this day, if we hold one. */
  sourceIcon: string | null;
};

export async function loadDayDetail(
  userId: string,
  profile: LoadedProfile,
  dayKey: string,
  /** Pinned like its sibling loaders, so a request that straddles local
   *  midnight measures its 7-day weight trend from one instant. */
  now: Date = new Date()
): Promise<DayDetail> {
  const tz = profile.timezone || "UTC";
  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const weekAgo = weekAgoFrom(now);
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

  // The same snapshot the write path builds. It picks this-day-vs-typical-day
  // once, so the active breakdown shown here always sums to the TDEE beside it
  // — a row that exists but is empty (the dashboard creates one per user per
  // day) would otherwise display "NEAT 0" against a TDEE that includes it.
  const snapshot = buildDailySnapshot(profile, activityLog);

  // A stored day keeps the burn written with it; the fresh snapshot is only the
  // fallback for rows written before those columns existed.
  const bmrKcal = activityLog?.bmrKcal ?? snapshot.columns.bmrKcal;
  const storedTdee = activityLog?.tdeeKcal ?? snapshot.columns.tdeeKcal;
  // Subtracting two stored doubles leaves dust (345.99999999999994), and every
  // burn term in this app is a whole number by contract — see ActiveResult.
  const storedActiveKcal = Math.round(storedTdee - bmrKcal);

  const targets = computeDayTargets({
    bmrKcal,
    baseTdeeKcal: storedTdee,
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
    activeKcal: storedActiveKcal,
    weight: dayWeight ? { id: dayWeight.id, weightKg: dayWeight.weightKg } : null,
    hasActivity: dayHasOwnActivity(activityLog),
    // Stored kcal for the day, with the formula/LBM of the compute that would
    // produce it — the same BmrResult shape the dashboard renders.
    bmr: { ...snapshot.bmr, kcal: targets.bmrKcal },
    // Left whole rather than having its total swapped for the stored one: the
    // parts are a fresh recompute, so pasting a stored total over them makes an
    // ActiveResult whose NEAT and EAT don't add up to its own kcal.
    active: snapshot.active,
    goalType: targets.goalType,
    goalPace: targets.goalPace,
    kcalOffset: targets.kcalOffset,
    lactationKcal: targets.lactationKcal,
    latestWeight: latestWeightLog
      ? { weightKg: latestWeightLog.weightKg, loggedAt: latestWeightLog.loggedAt }
      : null,
    delta7dKg: weightDelta7dKg(latestWeightLog, baselineWeightRaw),
    sourceIcon: await healthSourceIcon(userId, activityLog?.source),
  };
}
