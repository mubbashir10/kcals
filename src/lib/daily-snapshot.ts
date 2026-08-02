// Pure helpers for computing the daily TDEE snapshot stored on
// ActivityLog. We snapshot BMR + the user's typical-day default active
// kcal at write time so historical days stay stable even when the user
// changes their profile later.

import { calculateBmr, type BmrResult, type Sex } from "@/lib/bmr";
import {
  activeKcal,
  activeKcalDaily,
  type ActiveResult,
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

/**
 * Exactly the ActivityLog columns — the only part of a snapshot that may reach
 * a Prisma `data` argument. Kept as its own type because TypeScript drops
 * excess-property checking through a spread: with the rich fields alongside
 * these, `data: { ...snapshot }` type-checks and then fails at runtime on an
 * unknown argument. Writers spread `snapshot.columns`, which can't.
 */
export type DailySnapshotColumns = {
  bmrKcal: number;
  defaultActiveKcal: number;
  overrideActiveKcal: number | null;
  tdeeKcal: number;
};

export type DailySnapshot = {
  columns: DailySnapshotColumns;
  /** BMR with the formula actually used — for the "how we got this" readout. */
  bmr: BmrResult;
  /**
   * The active-energy result behind `columns.tdeeKcal` — the day's override if
   * it had one, else the typical day. Exposed so callers render the
   * steps/lifting/cardio breakdown without re-deciding which source won.
   */
  active: ActiveResult;
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
  overrideInputs?: DailyOverrideInputs | null,
  /** `inProgress` = this is today, still being lived. See `active` below. */
  opts: { inProgress?: boolean } = {}
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

  let override: ActiveResult | null = null;
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
      override = ov;
    }
  }

  // A day still in progress has only burned part of itself. The band reports
  // 11 kcal at 8am, which is a true "so far" but a useless *maintenance* — it
  // would put the day's target near BMR every morning and walk it upward all
  // day. Until the live figure overtakes the typical day, the typical day is
  // the better estimate of what this day will actually cost.
  const active =
    opts.inProgress && override != null && override.kcal < def.kcal
      ? def
      : override ?? def;

  return {
    columns: {
      bmrKcal: bmr.kcal,
      defaultActiveKcal: def.kcal,
      overrideActiveKcal: override?.kcal ?? null,
      tdeeKcal: bmr.kcal + active.kcal,
    },
    bmr,
    active,
  };
}
