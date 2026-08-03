// A day's burn:
//
//   BMR (from the bio)  +  active energy  =  what the day cost
//
// Active energy is the day's own number when the day has one — synced from a
// band, or entered by hand — and the profile's typical day when it doesn't.
// That is the whole rule. Nothing is forecast, nothing is blended: a day reads
// the same at 8am as it will at midnight, given the same inputs.
//
// What ActivityLog stores is `bmrKcal` and `tdeeKcal`. Active is the gap
// between them, so the stored day can't drift out of agreement with itself.

import { calculateBmr, type BmrResult, type Sex } from "@/lib/bmr";
import {
  activeKcal,
  typicalDayActiveKcal,
  type ActiveResult,
} from "@/lib/tdee";

// What we need from Profile. Kept narrow so the helper is callable from both
// the write and read paths without dragging in every Profile field.
export type SnapshotProfile = {
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  activeKcalOverride: number | null;
  stepsPerDay: number | null;
  liftingSessionsPerWeek: number | null;
  liftingMinutesPerSession: number | null;
  cardioSessionsPerWeek: number | null;
  cardioMinutesPerSession: number | null;
};

/** A day's own activity inputs, exactly as ActivityLog holds them. */
export type DayActivityInput = {
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  /** A supplied total — the band's, or one typed in. Wins over the rest. */
  activeKcal: number | null;
};

/**
 * Exactly the ActivityLog burn columns — the only part of a snapshot that may
 * reach a Prisma `data` argument. Kept as its own type because TypeScript drops
 * excess-property checking through a spread: with the rich fields alongside
 * these, `data: { ...snapshot }` type-checks and then fails at runtime on an
 * unknown argument. Writers spread `snapshot.columns`, which can't.
 */
export type DailySnapshotColumns = {
  bmrKcal: number;
  tdeeKcal: number;
};

export type DailySnapshot = {
  columns: DailySnapshotColumns;
  /** BMR with the formula actually used — for the "how we got this" readout. */
  bmr: BmrResult;
  /**
   * The active energy behind `columns.tdeeKcal` — the day's own if it had any,
   * else the typical day. Exposed so the UI renders the steps/lifting/cardio
   * breakdown without re-deciding which source won.
   */
  active: ActiveResult;
  /** False when the day is running on the typical day rather than its own. */
  logged: boolean;
  /** The typical day's active kcal, whether or not this day used it. The goal
   *  page previews a standing choice, so it wants the number that holds still. */
  typicalKcal: number;
};

/**
 * Does this day carry activity of its own, or is it running on the typical day?
 *
 * The one answer, because five surfaces ask it — the snapshot, the activity
 * card, the day's `hasActivity`, the calendar's dot, and the maintenance
 * breakdown — and any drift between them shows up as a day whose card tells a
 * story its burn doesn't. It reads the INPUTS, never the kcal they work out to:
 * three steps round to nothing, and a day is no less logged for it.
 *
 * A supplied zero counts. Somebody typed it, and "I didn't move today" is a
 * thing a person is allowed to say.
 */
export function dayHasOwnActivity(day: DayActivityInput | null): boolean {
  if (!day) return false;
  return (
    day.activeKcal != null ||
    (day.steps ?? 0) > 0 ||
    (day.liftingMin ?? 0) > 0 ||
    (day.cardioMin ?? 0) > 0
  );
}

/**
 * The two columns every burn read needs. Spread into a Prisma `select` so no
 * surface has to remember which pair a day's burn is derived from.
 */
export const ACTIVITY_BURN_SELECT = {
  bmrKcal: true,
  tdeeKcal: true,
} as const;

/**
 * Build the snapshot we'd write to ActivityLog right now.
 *
 * - `day` null/omitted, or carrying nothing → burn = BMR + the typical day
 * - `day` with something in it              → burn = BMR + that day's active
 */
export function buildDailySnapshot(
  profile: SnapshotProfile,
  day?: DayActivityInput | null
): DailySnapshot {
  const bmr = calculateBmr({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });

  const typical = typicalDayActiveKcal(profile);

  // A row can exist while saying nothing — the dashboard lazily creates one per
  // user per day just to hold the snapshot. Only a row with something in it
  // counts; the rest fall through to the typical day.
  const logged = dayHasOwnActivity(day ?? null);
  const active =
    logged && day ? activeKcal({ weightKg: profile.weightKg, ...day }) : typical;

  return {
    columns: { bmrKcal: bmr.kcal, tdeeKcal: bmr.kcal + active.kcal },
    bmr,
    active,
    logged,
    typicalKcal: typical.kcal,
  };
}
