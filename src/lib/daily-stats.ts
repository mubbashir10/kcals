// Shared computation for "what does this user's day look like right now?"
// Used by the home dashboard (own data) and friend view pages (read-only).

import { db } from "@/lib/db";
import { calculateBmr, type BmrResult, type Sex } from "@/lib/bmr";
import {
  activeKcal,
  activeKcalDaily,
  calculateTdee,
  type ActivityMode,
  type ActiveResult,
} from "@/lib/tdee";
import { dayKeyInTz, startOfDayInTz } from "@/lib/clock";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import {
  computeEffectiveTarget,
  computeKcalOffset,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { computeMacroGoals } from "@/lib/macros";
import { sumBy } from "@/lib/utils";

export type DailyStats = Awaited<ReturnType<typeof loadDailyStats>>;

export async function loadDailyStats(userId: string, now: Date = new Date()) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const tz = profile.timezone || "UTC";
  const todayKey = dayKeyInTz(tz, now);

  // Ensure today's ActivityLog row exists with snapshot fields. If it
  // doesn't, we lazy-create it with the current defaults so historical
  // TDEE stays pinned to the profile state at first interaction.
  let todayActivity = await db.activityLog.findUnique({
    where: { userId_dayKey: { userId, dayKey: todayKey } },
  });

  // Back-compat: if a row exists but predates the snapshot fields, fill
  // them in now. Cheap: one extra write the first time we see the row.
  const needsSnapshot =
    !todayActivity ||
    todayActivity.bmrKcal == null ||
    todayActivity.defaultActiveKcal == null ||
    todayActivity.tdeeKcal == null;

  if (needsSnapshot) {
    const snapshot = buildDailySnapshot(
      profile,
      todayActivity
        ? {
            mode: todayActivity.mode as ActivityMode,
            steps: todayActivity.steps,
            liftingMin: todayActivity.liftingMin,
            cardioMin: todayActivity.cardioMin,
            wearableKcal: todayActivity.wearableKcal,
          }
        : null
    );
    todayActivity = await db.activityLog.upsert({
      where: { userId_dayKey: { userId, dayKey: todayKey } },
      create: {
        userId,
        dayKey: todayKey,
        mode: "estimate",
        bmrKcal: snapshot.bmrKcal,
        defaultActiveKcal: snapshot.defaultActiveKcal,
        overrideActiveKcal: snapshot.overrideActiveKcal,
        tdeeKcal: snapshot.tdeeKcal,
      },
      update: {
        bmrKcal: snapshot.bmrKcal,
        defaultActiveKcal: snapshot.defaultActiveKcal,
        overrideActiveKcal: snapshot.overrideActiveKcal,
        tdeeKcal: snapshot.tdeeKcal,
      },
    });
  }

  // BMR for display — prefer the stored snapshot (historically stable),
  // fall back to live computation if for some reason it's null.
  const bmr: BmrResult =
    todayActivity?.bmrKcal != null
      ? {
          kcal: todayActivity.bmrKcal,
          formula:
            profile.bodyFatPct != null ? "katch-mcardle" : "mifflin-st-jeor",
        }
      : calculateBmr({
          sex: profile.sex as Sex,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          bodyFatPct: profile.bodyFatPct,
        });

  // Active source: override if present, else the default snapshot.
  const hasOverride =
    todayActivity != null &&
    (todayActivity.overrideActiveKcal != null ||
      (todayActivity.mode === "estimate" &&
        ((todayActivity.steps ?? 0) > 0 ||
          (todayActivity.liftingMin ?? 0) > 0 ||
          (todayActivity.cardioMin ?? 0) > 0)) ||
      (todayActivity.mode === "override" &&
        (todayActivity.wearableKcal ?? 0) > 0));

  const active: ActiveResult = hasOverride
    ? activeKcalDaily({
        weightKg: profile.weightKg,
        mode: todayActivity!.mode as ActivityMode,
        steps: todayActivity!.steps,
        liftingMin: todayActivity!.liftingMin,
        cardioMin: todayActivity!.cardioMin,
        wearableKcal: todayActivity!.wearableKcal,
      })
    : activeKcal({
        weightKg: profile.weightKg,
        mode: profile.activityMode as ActivityMode,
        stepsPerDay: profile.stepsPerDay,
        liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
        liftingMinutesPerSession: profile.liftingMinutesPerSession,
        cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
        cardioMinutesPerSession: profile.cardioMinutesPerSession,
        activeKcalOverride: profile.activeKcalOverride,
      });

  // TDEE comes from the stored snapshot when available, otherwise compute.
  const tdee =
    todayActivity?.tdeeKcal != null
      ? todayActivity.tdeeKcal
      : calculateTdee(bmr.kcal, active);

  // Goal-aware target. Goal lives on Profile and changes apply forward —
  // we deliberately don't snapshot it per-day yet (would let historical
  // days "freeze" old goals but adds storage churn for a feature we just
  // shipped). Revisit if users start comparing days across goal changes.
  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  const kcalOffset = computeKcalOffset(goalType, goalPace);
  const calorieGoal = computeEffectiveTarget(
    tdee,
    bmr.kcal,
    goalType,
    goalPace,
    profile.trackKcal
  );

  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [meals, latestWeight, baselineWeightRaw] = await Promise.all([
    db.meal.findMany({
      where: { userId, loggedAt: { gte: startOfDayInTz(tz, now) } },
      orderBy: { loggedAt: "desc" },
      include: { foods: { orderBy: { loggedAt: "asc" } } },
    }),
    db.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: "desc" },
    }),
    db.weightLog.findFirst({
      where: { userId, loggedAt: { lte: weekAgo } },
      orderBy: { loggedAt: "desc" },
    }),
  ]);
  const baselineWeight = latestWeight ? baselineWeightRaw : null;
  const delta7dKg =
    latestWeight && baselineWeight
      ? latestWeight.weightKg - baselineWeight.weightKg
      : null;

  const allFoods = meals.flatMap((m) => m.foods);
  const consumed = {
    kcal: sumBy(allFoods, "kcal"),
    protein: sumBy(allFoods, "proteinG"),
    carbs: sumBy(allFoods, "carbsG"),
    fat: sumBy(allFoods, "fatG"),
  };

  const macroGoals = computeMacroGoals(calorieGoal, profile);

  return {
    profile,
    tz,
    bmr,
    active,
    tdee,
    calorieGoal,
    goalType,
    goalPace,
    kcalOffset,
    todayActivity,
    meals,
    latestWeight,
    delta7dKg,
    consumed,
    foodCount: allFoods.length,
    macroGoals,
    todayKey,
  };
}


export type { ActiveResult, BmrResult };
