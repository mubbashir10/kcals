// Pure helpers for turning one day's activity inputs into the exact column set
// an ActivityLog row stores. Shared by the manual editor
// (app/actions/activity.ts) and the Health Connect sync (lib/health-sync.ts) so
// a hand-logged day and a synced day are shaped identically in the DB.

import {
  buildDailySnapshot,
  type DayActivityInput,
  type SnapshotProfile,
} from "@/lib/daily-snapshot";

export type ActivityLogInput = {
  steps?: number | null;
  liftingMin?: number | null;
  cardioMin?: number | null;
  /** A supplied active-calorie total — wins over the three fields above. */
  activeKcal?: number | null;
};

function sanitizeInt(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Math.round(value);
  if (v < min || v > max) return null;
  return v;
}

export function activityLogFields(
  profile: SnapshotProfile,
  input: ActivityLogInput
) {
  // Steps are worth keeping even alongside a supplied total: the sync sends
  // both so the app can say "N steps · M kcal". They simply don't drive the
  // burn while the total is there — see activeKcal in lib/tdee.ts.
  const day: DayActivityInput = {
    steps: sanitizeInt(input.steps, 0, 200000),
    liftingMin: sanitizeInt(input.liftingMin, 0, 600),
    cardioMin: sanitizeInt(input.cardioMin, 0, 600),
    activeKcal: sanitizeInt(input.activeKcal, 0, 10000),
  };

  return { ...day, ...buildDailySnapshot(profile, day).columns };
}
