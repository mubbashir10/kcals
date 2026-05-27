// Pure helpers for computing the daily TDEE snapshot stored on
// ActivityLog. We snapshot BMR + the user's typical-day default active
// kcal at write time so historical days stay stable even when the user
// changes their profile later.

import { calculateBmr, type Sex } from "@/lib/bmr";
import {
  activeKcal,
  activeKcalDaily,
  type ActivityMode,
} from "@/lib/tdee";

// What we need from Profile for the snapshot. Kept narrow so the helper
// is callable from both the action and read paths without dragging in
// every Profile field.
export type SnapshotProfile = {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  activityMode: string;
  stepsPerDay: number | null;
  liftingSessionsPerWeek: number | null;
  liftingMinutesPerSession: number | null;
  cardioSessionsPerWeek: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
};

export type DailySnapshot = {
  bmrKcal: number;
  defaultActiveKcal: number;
  overrideActiveKcal: number | null;
  tdeeKcal: number;
};

export type DailyOverrideInputs = {
  mode: ActivityMode;
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  wearableKcal: number | null;
};

/**
 * Build the snapshot we'd write to ActivityLog right now.
 *
 * - `overrideInputs` null/undefined → no override, TDEE = BMR + default
 * - `overrideInputs` set            → TDEE = BMR + (override total)
 */
export function buildDailySnapshot(
  profile: SnapshotProfile,
  overrideInputs?: DailyOverrideInputs | null
): DailySnapshot {
  const bmr = calculateBmr({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });

  // The user's typical-day default — derived from profile settings only.
  const def = activeKcal({
    weightKg: profile.weightKg,
    mode: profile.activityMode as ActivityMode,
    stepsPerDay: profile.stepsPerDay,
    liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
    liftingMinutesPerSession: profile.liftingMinutesPerSession,
    cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
    cardioMinutesPerSession: profile.cardioMinutesPerSession,
    activeKcalOverride: profile.activeKcalOverride,
  });

  let overrideActive: number | null = null;
  if (overrideInputs) {
    const ov = activeKcalDaily({
      weightKg: profile.weightKg,
      mode: overrideInputs.mode,
      steps: overrideInputs.steps,
      liftingMin: overrideInputs.liftingMin,
      cardioMin: overrideInputs.cardioMin,
      wearableKcal: overrideInputs.wearableKcal,
    });
    // `none` means the user "logged" but provided nothing useful — treat
    // as no override so we fall back to default.
    if (ov.source !== "none") {
      overrideActive = ov.kcal;
    }
  }

  const activeForTdee = overrideActive ?? def.kcal;

  return {
    bmrKcal: bmr.kcal,
    defaultActiveKcal: def.kcal,
    overrideActiveKcal: overrideActive,
    tdeeKcal: bmr.kcal + activeForTdee,
  };
}
