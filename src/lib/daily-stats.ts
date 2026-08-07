// Shared computation for "what does this user's day look like right now?"
// Used by the home dashboard (own data) and friend view pages (read-only).

import { db } from "@/lib/db";
import { dayKeyInTz, startOfDayInTz } from "@/lib/clock";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import { dayTargetsFor } from "@/lib/day-energy";
import { healthSourceIcon } from "@/lib/health-sync";
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
  const snapshot = buildDailySnapshot(profile, todayActivity);
  const snapshotFields = snapshot.columns;

  const snapshotStale =
    !todayActivity ||
    todayActivity.bmrKcal !== snapshotFields.bmrKcal ||
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
        create: { userId, dayKey: todayKey, ...snapshotFields },
        update: snapshotFields,
      });
    }
  }

  // The snapshot already decided this-day-vs-typical-day, so reading its
  // breakdown back keeps the displayed terms and the stored TDEE in agreement.
  const { bmr, active } = snapshot;

  // Bound once: the goal and the lactation bump depend only on the profile, and
  // both targets below share them.
  const targetsForDay = dayTargetsFor(profile);
  const targets = targetsForDay(snapshotFields.bmrKcal, snapshotFields.tdeeKcal);

  // The same chain on the typical day instead of this one. Choosing a goal is a
  // standing decision, so the screen that previews it wants the number that
  // holds still rather than one a hard day already moved.
  const typicalTargets = targetsForDay(
    snapshotFields.bmrKcal,
    snapshotFields.bmrKcal + snapshot.typicalKcal
  );

  const weekAgo = weekAgoFrom(now);
  const [meals, latestWeight, baselineWeightRaw, sourceIcon] = await Promise.all([
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
    // The icon of whichever app synced the day, so the provenance line can say
    // "Mi Fitness" with Mi Fitness's own mark rather than a stock watch.
    healthSourceIcon(userId, todayActivity?.source),
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
    /** Maintenance + target for a typical day — see `typicalTargets` above. */
    typical: {
      tdee: typicalTargets.tdeeKcal,
      calorieGoal: typicalTargets.calorieGoal,
    },
    lactationKcal: targets.lactationKcal,
    calorieGoal: targets.calorieGoal,
    goalType: targets.goalType,
    goalPace: targets.goalPace,
    kcalOffset: targets.kcalOffset,
    todayActivity,
    sourceIcon,
    meals,
    latestWeight,
    delta7dKg: weightDelta7dKg(latestWeight, baselineWeightRaw),
    consumed,
    foodCount: allFoods.length,
    macroGoals: targets.macroGoals,
    todayKey,
  };
}
