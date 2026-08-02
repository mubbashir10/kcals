// Shared computation for "what does this user's day look like right now?"
// Used by the home dashboard (own data) and friend view pages (read-only).

import { db } from "@/lib/db";
import type { ActivityMode } from "@/lib/tdee";
import { dayKeyInTz, startOfDayInTz } from "@/lib/clock";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import { computeDayTargets } from "@/lib/day-energy";
import { normalizeMealSort } from "@/lib/widget-order";
import { sumBy } from "@/lib/utils";
import { weekAgoFrom, weightDelta7dKg } from "@/lib/weight";

export type DailyStats = Awaited<ReturnType<typeof loadDailyStats>>;

export type LoadDailyStatsOptions = {
  /** Skip the snapshot upsert so reading a friend's day doesn't write
   *  to their ActivityLog row. The function still returns sensible
   *  values by computing the snapshot in-memory from the profile. */
  readOnly?: boolean;
};

export async function loadDailyStats(
  userId: string,
  now: Date = new Date(),
  opts: LoadDailyStatsOptions = {}
) {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const tz = profile.timezone || "UTC";
  const todayKey = dayKeyInTz(tz, now);

  let todayActivity = await db.activityLog.findUnique({
    where: { userId_dayKey: { userId, dayKey: todayKey } },
  });

  // Today's snapshot must track the *current* profile — this function only ever
  // runs for "today", so a stale stored TDEE would freeze the calorie goal while
  // edits to steps or weight moved the numbers around it. Rebuild from the row's
  // override, then refresh the row whenever it drifts (which also back-fills
  // rows predating the snapshot columns). Everything below reads this snapshot.
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
  const snapshotFields = snapshot.columns;

  const snapshotStale =
    !todayActivity ||
    todayActivity.bmrKcal !== snapshotFields.bmrKcal ||
    todayActivity.defaultActiveKcal !== snapshotFields.defaultActiveKcal ||
    todayActivity.overrideActiveKcal !== snapshotFields.overrideActiveKcal ||
    todayActivity.tdeeKcal !== snapshotFields.tdeeKcal;

  if (snapshotStale) {
    if (opts.readOnly) {
      // Friend-view read: synthesize the snapshot fields in-memory so
      // downstream code reads them off `todayActivity`, but don't
      // persist anything to the friend's row.
      todayActivity = todayActivity
        ? { ...todayActivity, ...snapshotFields }
        : null;
    } else {
      todayActivity = await db.activityLog.upsert({
        where: { userId_dayKey: { userId, dayKey: todayKey } },
        create: { userId, dayKey: todayKey, mode: "estimate", ...snapshotFields },
        update: snapshotFields,
      });
    }
  }

  // The snapshot already decided override-vs-typical-day, so reading its
  // breakdown back keeps the displayed terms and the stored TDEE in agreement.
  const { bmr, active } = snapshot;

  const targets = computeDayTargets({
    bmrKcal: snapshotFields.bmrKcal,
    baseTdeeKcal: snapshotFields.tdeeKcal,
    profile,
  });

  const weekAgo = weekAgoFrom(now);
  const [meals, latestWeight, baselineWeightRaw] = await Promise.all([
    db.meal.findMany({
      where: { userId, loggedAt: { gte: startOfDayInTz(tz, now) } },
      orderBy: { loggedAt: normalizeMealSort(profile.mealSortDir) },
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
  const allFoods = meals.flatMap((m) => m.foods);
  const consumed = {
    kcal: sumBy(allFoods, "kcal"),
    protein: sumBy(allFoods, "proteinG"),
    carbs: sumBy(allFoods, "carbsG"),
    fat: sumBy(allFoods, "fatG"),
  };

  return {
    profile,
    tz,
    bmr,
    active,
    tdee: targets.tdeeKcal,
    lactationKcal: targets.lactationKcal,
    calorieGoal: targets.calorieGoal,
    goalType: targets.goalType,
    goalPace: targets.goalPace,
    kcalOffset: targets.kcalOffset,
    todayActivity,
    meals,
    latestWeight,
    delta7dKg: weightDelta7dKg(latestWeight, baselineWeightRaw),
    consumed,
    foodCount: allFoods.length,
    macroGoals: targets.macroGoals,
    todayKey,
  };
}
