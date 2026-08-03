// Active energy — the term a day's burn adds to BMR.
//
// One rule, and it applies at both levels: a supplied kcal total wins over
// anything computed from movement. A band's daily figure and a number typed by
// hand are the same kind of thing, so they share a field, and that field beats
// the estimate. Nothing here forecasts — a day's active energy is whatever its
// inputs say it is, at 8am and at midnight alike.

export type ActivityInput = {
  weightKg: number;
  /** A supplied active-calorie total. Wins over the movement fields below. */
  activeKcal?: number | null;
  steps?: number | null;
  liftingMin?: number | null;
  cardioMin?: number | null;
};

export type ActiveResult = {
  /**
   * Whole kcal, deliberately. Burn is printed as `round(tdee) − round(bmr)`,
   * which equals this only while it's an integer (adding a whole number
   * commutes with rounding). Leave it fractional and the day equation says 346
   * beside a card saying 347.
   */
  kcal: number;
  fromSteps: number;
  fromLifting: number;
  fromCardio: number;
  /** `kcal` was supplied rather than summed — the parts are all zero. */
  direct: boolean;
};

// ~0.04 kcal/step for a 70 kg adult, scaled linearly by body weight.
const KCAL_PER_STEP_PER_KG = 0.04 / 70;

// Per-minute kcal rates (scaled by body weight in kg).
// Lifting: ~5 kcal/kg per 60-min session → ~0.083 kcal/min/kg (moderate)
// Cardio: ~8 kcal/min at 70 kg (mixed-intensity average) → ~0.114 kcal/min/kg
const LIFTING_KCAL_PER_MIN_PER_KG = 5 / 60;
const CARDIO_KCAL_PER_MIN_PER_KG = 8 / 70;

// Used when a session count is set but its duration is left blank.
const DEFAULT_LIFTING_MIN = 60;
const DEFAULT_CARDIO_MIN = 30;

/** A day's active energy from whatever that day has to offer. */
export function activeKcal(input: ActivityInput): ActiveResult {
  const supplied = input.activeKcal;
  if (typeof supplied === "number" && Number.isFinite(supplied) && supplied >= 0) {
    return {
      kcal: Math.round(supplied),
      fromSteps: 0,
      fromLifting: 0,
      fromCardio: 0,
      direct: true,
    };
  }

  const fromSteps = (input.steps ?? 0) * input.weightKg * KCAL_PER_STEP_PER_KG;
  const fromLifting =
    (input.liftingMin ?? 0) * input.weightKg * LIFTING_KCAL_PER_MIN_PER_KG;
  const fromCardio =
    (input.cardioMin ?? 0) * input.weightKg * CARDIO_KCAL_PER_MIN_PER_KG;

  return {
    kcal: Math.round(fromSteps + fromLifting + fromCardio),
    fromSteps,
    fromLifting,
    fromCardio,
    direct: false,
  };
}

/** The Profile columns the typical day is built from — a real row satisfies it. */
export type TypicalDayInput = {
  weightKg: number;
  activeKcalOverride?: number | null;
  stepsPerDay?: number | null;
  liftingSessionsPerWeek?: number | null;
  liftingMinutesPerSession?: number | null;
  cardioSessionsPerWeek?: number | null;
  cardioMinutesPerSession?: number | null;
};

/** Weekly sessions spread across the week, as minutes per day. */
function minutesPerDay(
  sessionsPerWeek: number | null | undefined,
  minutesPerSession: number | null | undefined,
  fallbackMinutes: number
): number {
  const sessions = sessionsPerWeek ?? 0;
  if (sessions <= 0) return 0;
  return (sessions * (minutesPerSession ?? fallbackMinutes)) / 7;
}

/**
 * The user's typical day, from the profile alone — the number every day starts
 * on, and stays on unless that day brings its own.
 */
export function typicalDayActiveKcal(profile: TypicalDayInput): ActiveResult {
  return activeKcal({
    weightKg: profile.weightKg,
    activeKcal: profile.activeKcalOverride,
    steps: profile.stepsPerDay,
    liftingMin: minutesPerDay(
      profile.liftingSessionsPerWeek,
      profile.liftingMinutesPerSession,
      DEFAULT_LIFTING_MIN
    ),
    cardioMin: minutesPerDay(
      profile.cardioSessionsPerWeek,
      profile.cardioMinutesPerSession,
      DEFAULT_CARDIO_MIN
    ),
  });
}
