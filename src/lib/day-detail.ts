// Everything-for-one-day: consumed macros, the day's BMR/Active/TDEE, the
// effective calorie + macro targets, steps/activity, and the day's weight.
// Shared by the /day/[date] page and the /calendar day summary so both read
// the same numbers. BMR/TDEE prefer the day's stored ActivityLog snapshot and
// fall back to the current profile (same compromise as daily-history.ts).

import { db } from "@/lib/db";
import { calculateBmr, type BmrResult, type Sex } from "@/lib/bmr";
import { startOfDayForDayKey } from "@/lib/clock";
import { normalizeMealSort } from "@/lib/widget-order";
import {
  computeEffectiveTarget,
  computeKcalOffset,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { lactationKcal, lactationFloor } from "@/lib/lactation";
import { computeMacroGoals, type MacroGoals } from "@/lib/macros";
import {
  activeKcal,
  activeKcalDaily,
  calculateTdee,
  type ActivityMode,
  type ActiveResult,
} from "@/lib/tdee";
import { sumBy } from "@/lib/utils";

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

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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

  const fallbackBmr = calculateBmr({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });
  const fallbackActive = activeKcal({
    weightKg: profile.weightKg,
    mode: profile.activityMode as ActivityMode,
    stepsPerDay: profile.stepsPerDay,
    liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
    liftingMinutesPerSession: profile.liftingMinutesPerSession,
    cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
    cardioMinutesPerSession: profile.cardioMinutesPerSession,
    activeKcalOverride: profile.activeKcalOverride,
  });
  const fallbackTdee = calculateTdee(fallbackBmr.kcal, fallbackActive);

  const bmrKcal = activityLog?.bmrKcal ?? fallbackBmr.kcal;
  // Lactation adds the milk-production cost on top of burned energy (applies
  // forward from the current profile, same as the goal — not snapshotted).
  const tdeeKcal = (activityLog?.tdeeKcal ?? fallbackTdee) + lactationKcal(profile);

  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  const calorieGoal = computeEffectiveTarget(
    tdeeKcal,
    bmrKcal,
    goalType,
    goalPace,
    profile.trackKcal,
    lactationFloor(profile)
  );
  const macroGoals = computeMacroGoals(calorieGoal, profile);

  const activeKcalToday = activityLog
    ? activeKcalDaily({
        weightKg: profile.weightKg,
        mode: activityLog.mode as ActivityMode,
        steps: activityLog.steps,
        liftingMin: activityLog.liftingMin,
        cardioMin: activityLog.cardioMin,
        wearableKcal: activityLog.wearableKcal,
      })
    : fallbackActive;

  const dayWeight = weightLogs.at(-1) ?? null;

  const baselineWeight = latestWeightLog ? baselineWeightRaw : null;
  const delta7dKg =
    latestWeightLog && baselineWeight
      ? latestWeightLog.weightKg - baselineWeight.weightKg
      : null;

  return {
    dayKey,
    meals,
    activityLog,
    consumed,
    foodCount: allFoods.length,
    calorieGoal,
    macroGoals,
    bmrKcal,
    tdeeKcal,
    activeKcal: activeKcalToday.kcal,
    weight: dayWeight ? { id: dayWeight.id, weightKg: dayWeight.weightKg } : null,
    hasActivity:
      activityLog != null &&
      ((activityLog.steps ?? 0) > 0 ||
        (activityLog.liftingMin ?? 0) > 0 ||
        (activityLog.cardioMin ?? 0) > 0 ||
        (activityLog.wearableKcal ?? 0) > 0),
    bmr: { kcal: bmrKcal, formula: fallbackBmr.formula },
    active: activeKcalToday,
    goalType,
    goalPace,
    kcalOffset: computeKcalOffset(goalType, goalPace),
    lactationKcal: lactationKcal(profile),
    latestWeight: latestWeightLog
      ? { weightKg: latestWeightLog.weightKg, loggedAt: latestWeightLog.loggedAt }
      : null,
    delta7dKg,
  };
}
