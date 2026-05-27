// Per-day historical aggregates for the user. Powers /calories, /diary,
// /calendar, and the day detail page.
//
// Goal handling: goalType / goalPace / trackKcal live on Profile and are
// NOT snapshotted per day (see daily-stats.ts). For each historical day we
// reuse the day's stored TDEE/BMR snapshot when present and fall back to a
// freshly computed estimate from the current profile when not. The resulting
// goal/macro targets are therefore "what today's settings would have meant
// for that day" — accurate forward but not retroactive across goal changes.

import { db } from "@/lib/db";
import { dayKeyInTz } from "@/lib/clock";
import { calculateBmr, type Sex } from "@/lib/bmr";
import { activeKcal, calculateTdee, type ActivityMode } from "@/lib/tdee";
import { computeMacroGoals, type MacroGoals } from "@/lib/macros";
import {
  computeEffectiveTarget,
  computeKcalOffset,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";

export type DayConsumed = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type DailyHistoryEntry = {
  dayKey: string; // "YYYY-MM-DD" in the user's timezone
  consumed: DayConsumed;
  foodCount: number;
  calorieGoal: number;
  macroGoals: MacroGoals;
  bmrKcal: number;
  tdeeKcal: number;
  weightKg: number | null;
  hasFood: boolean;
  hasActivity: boolean;
  hasWeight: boolean;
};

export type DailyHistoryResult = {
  profile: Awaited<ReturnType<typeof db.profile.findUnique>>;
  tz: string;
  entries: DailyHistoryEntry[];
  goalType: GoalType;
  goalPace: GoalPace | null;
  kcalOffset: number;
};

// Look back `sinceDays` from now. Defaults to ~1 year — chart + list want a
// reasonable window without paging.
export async function loadDailyHistory(
  userId: string,
  sinceDays: number = 365
): Promise<DailyHistoryResult | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const tz = profile.timezone || "UTC";
  const since = new Date(Date.now() - sinceDays * 86400_000);

  const [foods, activityLogs, weightLogs] = await Promise.all([
    db.food.findMany({
      where: { meal: { userId }, loggedAt: { gte: since } },
      select: {
        kcal: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        loggedAt: true,
      },
    }),
    db.activityLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      select: { dayKey: true, tdeeKcal: true, bmrKcal: true },
    }),
    db.weightLog.findMany({
      where: { userId, loggedAt: { gte: since } },
      orderBy: { loggedAt: "asc" },
      select: { weightKg: true, loggedAt: true },
    }),
  ]);

  const foodByDay = new Map<string, DayConsumed & { count: number }>();
  for (const f of foods) {
    const key = dayKeyInTz(tz, f.loggedAt);
    const ex =
      foodByDay.get(key) ??
      { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 };
    ex.kcal += f.kcal;
    ex.protein += f.proteinG;
    ex.carbs += f.carbsG;
    ex.fat += f.fatG;
    ex.count += 1;
    foodByDay.set(key, ex);
  }

  const tdeeByDay = new Map<string, { tdee: number; bmr: number }>();
  for (const a of activityLogs) {
    if (a.tdeeKcal != null && a.bmrKcal != null) {
      tdeeByDay.set(a.dayKey, { tdee: a.tdeeKcal, bmr: a.bmrKcal });
    }
  }

  // Keep the latest weigh-in on each day (loggedAt asc above means later
  // entries overwrite earlier ones).
  const weightByDay = new Map<string, number>();
  for (const w of weightLogs) {
    const key = dayKeyInTz(tz, w.loggedAt);
    weightByDay.set(key, w.weightKg);
  }

  // Fallback BMR/TDEE for any day without an ActivityLog snapshot.
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

  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  const kcalOffset = computeKcalOffset(goalType, goalPace);

  const allKeys = new Set<string>([
    ...foodByDay.keys(),
    ...tdeeByDay.keys(),
    ...weightByDay.keys(),
  ]);

  const entries: DailyHistoryEntry[] = Array.from(allKeys)
    .sort((a, b) => b.localeCompare(a))
    .map((dayKey) => {
      const f = foodByDay.get(dayKey);
      const consumed: DayConsumed = f
        ? { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat }
        : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
      const foodCount = f?.count ?? 0;

      const tdeeSnap = tdeeByDay.get(dayKey);
      const bmrKcal = tdeeSnap?.bmr ?? fallbackBmr.kcal;
      const tdeeKcal = tdeeSnap?.tdee ?? fallbackTdee;
      const calorieGoal = computeEffectiveTarget(
        tdeeKcal,
        bmrKcal,
        goalType,
        goalPace,
        profile.trackKcal
      );
      const macroGoals = computeMacroGoals(calorieGoal, profile);
      const weightKg = weightByDay.get(dayKey) ?? null;

      return {
        dayKey,
        consumed,
        foodCount,
        calorieGoal,
        macroGoals,
        bmrKcal,
        tdeeKcal,
        weightKg,
        hasFood: !!f,
        hasActivity: tdeeByDay.has(dayKey),
        hasWeight: weightByDay.has(dayKey),
      };
    });

  return { profile, tz, entries, goalType, goalPace, kcalOffset };
}
