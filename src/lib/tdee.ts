// TDEE (Total Daily Energy Expenditure) = BMR + active calories.
// Active = NEAT (steps) + EAT (lifting + cardio), or a manual override
// from a wearable tracker.

export type ActivityMode = "estimate" | "override";

export type ActivityInput = {
  weightKg: number;
  mode: ActivityMode;
  stepsPerDay?: number | null;
  liftingSessionsPerWeek?: number | null;
  liftingMinutesPerSession?: number | null;
  cardioSessionsPerWeek?: number | null;
  cardioMinutesPerSession?: number | null;
  activeKcalOverride?: number | null;
};

export type ActiveResult = {
  kcal: number;
  fromSteps: number;
  fromLifting: number;
  fromCardio: number;
  override: number | null;
  source: "estimate" | "override" | "none";
};

// ~0.04 kcal/step for a 70 kg adult, scaled linearly by body weight.
const KCAL_PER_STEP_PER_KG = 0.04 / 70;

// Per-minute kcal rates (scaled by body weight in kg).
// Lifting: ~5 kcal/kg per 60-min session → ~0.083 kcal/min/kg (moderate)
// Cardio: ~8 kcal/min at 70 kg (mixed-intensity average) → ~0.114 kcal/min/kg
const LIFTING_KCAL_PER_MIN_PER_KG = 5 / 60;
const CARDIO_KCAL_PER_MIN_PER_KG = 8 / 70;

// Defaults if user enters a session count but leaves duration blank.
const DEFAULT_LIFTING_MIN = 60;
const DEFAULT_CARDIO_MIN = 30;

export function activeKcal(input: ActivityInput): ActiveResult {
  if (
    input.mode === "override" &&
    typeof input.activeKcalOverride === "number" &&
    input.activeKcalOverride >= 0
  ) {
    return {
      kcal: input.activeKcalOverride,
      fromSteps: 0,
      fromLifting: 0,
      fromCardio: 0,
      override: input.activeKcalOverride,
      source: "override",
    };
  }

  const steps = input.stepsPerDay ?? 0;
  const liftSessions = input.liftingSessionsPerWeek ?? 0;
  const liftMin = input.liftingMinutesPerSession ?? DEFAULT_LIFTING_MIN;
  const cardioSessions = input.cardioSessionsPerWeek ?? 0;
  const cardioMin = input.cardioMinutesPerSession ?? DEFAULT_CARDIO_MIN;

  if (steps <= 0 && liftSessions <= 0 && cardioSessions <= 0) {
    return {
      kcal: 0,
      fromSteps: 0,
      fromLifting: 0,
      fromCardio: 0,
      override: null,
      source: "none",
    };
  }

  const fromSteps = steps * input.weightKg * KCAL_PER_STEP_PER_KG;

  const fromLifting =
    (liftSessions * liftMin * input.weightKg * LIFTING_KCAL_PER_MIN_PER_KG) /
    7;

  const fromCardio =
    (cardioSessions *
      cardioMin *
      input.weightKg *
      CARDIO_KCAL_PER_MIN_PER_KG) /
    7;

  return {
    kcal: fromSteps + fromLifting + fromCardio,
    fromSteps,
    fromLifting,
    fromCardio,
    override: null,
    source: "estimate",
  };
}

export function calculateTdee(bmrKcal: number, active: ActiveResult): number {
  return bmrKcal + active.kcal;
}
