export type Sex = "male" | "female";

export type BmrInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
};

export type BmrResult = {
  kcal: number;
  formula: "katch-mcardle" | "mifflin-st-jeor";
  /** Lean body mass in kg (only for Katch-McArdle). */
  lbmKg?: number;
};

/**
 * Basal Metabolic Rate.
 * Uses Katch-McArdle when body-fat % is known (more accurate),
 * falls back to Mifflin-St Jeor otherwise.
 */
export function calculateBmr(input: BmrInput): BmrResult {
  const { sex, age, heightCm, weightKg, bodyFatPct } = input;

  if (typeof bodyFatPct === "number" && bodyFatPct > 0 && bodyFatPct < 100) {
    const lbmKg = weightKg * (1 - bodyFatPct / 100);
    return {
      kcal: 370 + 21.6 * lbmKg,
      formula: "katch-mcardle",
      lbmKg,
    };
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return {
    kcal: sex === "male" ? base + 5 : base - 161,
    formula: "mifflin-st-jeor",
  };
}

// Unit helpers — we store metric internally.
export const inToCm = (inches: number) => inches * 2.54;
export const cmToIn = (cm: number) => cm / 2.54;
export const lbToKg = (lb: number) => lb / 2.20462;
export const kgToLb = (kg: number) => kg * 2.20462;
