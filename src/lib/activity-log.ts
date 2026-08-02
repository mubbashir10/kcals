// Pure helpers for turning one day's activity override into the exact column
// set an ActivityLog row stores. Shared by the manual editor
// (app/actions/activity.ts) and the Health Connect backfill (lib/health-sync.ts)
// so a hand-logged day and a synced day are shaped identically in the DB.

import { buildDailySnapshot, type SnapshotProfile } from "@/lib/daily-snapshot";
import type { ActivityMode } from "@/lib/tdee";

export type ActivityLogInput = {
  mode: ActivityMode;
  steps?: number | null;
  liftingMin?: number | null;
  cardioMin?: number | null;
  wearableKcal?: number | null;
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
  const mode: ActivityMode = input.mode === "override" ? "override" : "estimate";

  const override =
    mode === "override"
      ? {
          mode,
          // Steps are kept for DISPLAY only (TDEE uses wearableKcal in override
          // mode and ignores steps — see lib/tdee.ts). The Health Connect sync
          // passes both so the app can show "N steps · M kcal"; manual override
          // entry passes no steps, so this stays null there.
          steps: sanitizeInt(input.steps, 0, 200000),
          liftingMin: null,
          cardioMin: null,
          wearableKcal: sanitizeInt(input.wearableKcal, 0, 10000),
        }
      : {
          mode,
          steps: sanitizeInt(input.steps, 0, 200000),
          liftingMin: sanitizeInt(input.liftingMin, 0, 600),
          cardioMin: sanitizeInt(input.cardioMin, 0, 600),
          wearableKcal: null,
        };

  const snapshot = buildDailySnapshot(profile, override);

  return {
    ...override,
    ...snapshot.columns,
  };
}
