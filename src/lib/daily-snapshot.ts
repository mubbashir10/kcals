// Two jobs, deliberately kept apart:
//
//   buildDailySnapshot  →  the day AS RECORDED, the columns ActivityLog stores.
//                          BMR + the typical-day default are snapshotted at
//                          write time so history stays stable when the profile
//                          changes later.
//   dayOutlook          →  the day AS IT READS NOW. Today has only burned part
//                          of itself, so what it will cost is part forecast.
//
// Only the first is ever persisted. Mixing them is how today's row ended up
// meaning one thing to the dashboard and another to the sync that wrote it.

import { calculateBmr, type BmrResult, type Sex } from "@/lib/bmr";
import { clamp01 } from "@/lib/utils";
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

/**
 * A day's burn as it should be read at this moment, which is not the same
 * thing as what's on record for it. Only `activeKcal`/`tdeeKcal` drive the
 * target; the rest is the arithmetic spelled out, so the UI can say where a
 * projected number came from instead of just asserting it.
 */
export type DayOutlook = {
  bmrKcal: number;
  /** Active kcal the day's TDEE and calorie target should use. */
  activeKcal: number;
  /** What the day's maintenance works out to. */
  tdeeKcal: number;
  /** Active kcal actually on record so far — null when nothing is logged. */
  soFarKcal: number | null;
  /** The slice of `activeKcal` that hasn't happened yet. 0 unless projected,
   *  so it never reads as a remainder that was already counted. */
  restOfDayKcal: number;
  /** True while `activeKcal` is part forecast — every surface flags this. */
  projected: boolean;
};

/**
 * The forecast half of a `DayOutlook`, for the surfaces that only need to say
 * where a projected number came from. Narrowed to a non-null `soFarKcal`,
 * which is what `projected` actually guarantees but the type can't.
 */
export type BurnProjection = Pick<DayOutlook, "restOfDayKcal"> & {
  soFarKcal: number;
};

/** `null` on a settled day. The one place that narrowing lives. */
export function burnProjectionOf(outlook: DayOutlook): BurnProjection | null {
  if (!outlook.projected || outlook.soFarKcal == null) return null;
  return {
    soFarKcal: outlook.soFarKcal,
    restOfDayKcal: outlook.restOfDayKcal,
  };
}

/**
 * The ActivityLog columns a stored day's burn can be re-derived from. Spread
 * into a Prisma `select` — every history surface needs the same four, because
 * a row's `tdeeKcal` alone can't be re-projected once the day is today.
 */
export const ACTIVITY_OUTLOOK_SELECT = {
  tdeeKcal: true,
  bmrKcal: true,
  defaultActiveKcal: true,
  overrideActiveKcal: true,
} as const;

/** A stored row, as `ACTIVITY_OUTLOOK_SELECT` returns it (all nullable). */
export type ActivityOutlookRow = {
  [K in keyof typeof ACTIVITY_OUTLOOK_SELECT]: number | null;
};

/**
 * A logged day's TDEE for display: the stored figure once the day is settled,
 * re-projected while it isn't. `null` when the row predates the snapshot
 * columns and has nothing to offer.
 *
 * Shared by every history surface so today's burn can't read one way on the
 * dashboard and another on the week page — which is exactly what happened
 * while each derived it for itself.
 */
export function loggedDayTdee(
  row: ActivityOutlookRow,
  /** Share of the day lived; 1 for any day that isn't today. */
  elapsed: number
): number | null {
  if (row.bmrKcal != null && row.defaultActiveKcal != null) {
    return dayOutlook({
      bmrKcal: row.bmrKcal,
      defaultActiveKcal: row.defaultActiveKcal,
      overrideActiveKcal: row.overrideActiveKcal,
      elapsed,
    }).tdeeKcal;
  }
  return row.tdeeKcal;
}

/**
 * What a day's burn looks like right now.
 *
 * A day still being lived has only burned part of itself, so neither number on
 * hand is its cost. The band's running total (11 kcal at 8am) is a truthful
 * "so far" and a useless *maintenance* — take it literally and the target sits
 * near BMR every morning and walks upward all day. The typical day doesn't
 * have that problem but ignores how this particular day is actually going. So
 * spend the day walking from one to the other:
 *
 *     what's burned so far  +  a typical day's worth of what's left
 *
 * At the top of the waking window that is the typical day (plus anything a
 * band already logged overnight), so no morning opens with a collapsed target.
 * At the end it is exactly what the band recorded, so a genuinely still day
 * settles honestly. In between, a slow morning eases the target down and a
 * hard one pushes it up.
 *
 * `elapsed` is the share of the waking day already lived (`dayElapsedFraction`
 * in lib/clock.ts). It defaults to 1 — a settled day — so every caller that
 * isn't looking at today gets the recorded figure without opting out.
 */
export function dayOutlook({
  bmrKcal,
  defaultActiveKcal,
  overrideActiveKcal,
  elapsed = 1,
}: Omit<DailySnapshotColumns, "tdeeKcal"> & {
  elapsed?: number;
}): DayOutlook {
  // Whole kcal, and deliberately so. The day equation prints its burn term as
  // `round(tdee) − round(bmr)`, which equals `activeKcal` exactly only while
  // `activeKcal` is an integer (adding a whole number commutes with rounding).
  // Leave it fractional and the equation says 346 next to a card saying 347 —
  // the same one-off drift the goal term was fixed for.
  const restOfDayKcal = Math.round(clamp01(1 - elapsed) * defaultActiveKcal);
  const soFarKcal =
    overrideActiveKcal == null ? null : Math.round(overrideActiveKcal);
  // With nothing on record there is nothing to project *from*: the typical day
  // is the whole estimate, all day long. Projecting anyway would decay the
  // target toward zero for anyone who simply doesn't wear a band.
  const activeKcal =
    soFarKcal == null
      ? Math.round(defaultActiveKcal)
      : soFarKcal + restOfDayKcal;
  // Once the remainder rounds away there is nothing left to forecast — the
  // day's figure is the recorded one, and the "est." marks come off.
  const projected = soFarKcal != null && restOfDayKcal > 0;
  return {
    bmrKcal,
    activeKcal,
    tdeeKcal: bmrKcal + activeKcal,
    soFarKcal,
    restOfDayKcal: projected ? restOfDayKcal : 0,
    projected,
  };
}

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
 *
 * What comes back is the day *as recorded*, never a forecast, so the row stays
 * historically true and doesn't churn with the clock. Reading a live day's
 * burn is `dayOutlook`'s job — feed it `columns`.
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

  const active = override ?? def;

  const columns: DailySnapshotColumns = {
    bmrKcal: bmr.kcal,
    defaultActiveKcal: def.kcal,
    overrideActiveKcal: override?.kcal ?? null,
    tdeeKcal: bmr.kcal + active.kcal,
  };

  return { columns, bmr, active };
}
