export type Sex = "male" | "female";
export type Units = "metric" | "imperial";
export type BmrFormula = "katch-mcardle" | "mifflin-st-jeor";

export function isSex(s: unknown): s is Sex {
  return s === "male" || s === "female";
}

export function isUnits(s: unknown): s is Units {
  return s === "metric" || s === "imperial";
}

export type BmrInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number | null;
};

export type BmrResult = {
  kcal: number;
  formula: BmrFormula;
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

import { round1 } from "@/lib/utils";

export function unitLabel(units: Units): "kg" | "lb" {
  return units === "imperial" ? "lb" : "kg";
}

/** Convert kg to the user's display unit, rounded to 1dp. */
export function displayWeight(kg: number, units: Units): { value: string; unit: "kg" | "lb" } {
  const display = units === "imperial" ? kgToLb(kg) : kg;
  return { value: round1(display).toFixed(1), unit: unitLabel(units) };
}

/** Signed weight delta string ("+1.2 lb", "−0.5 kg", "±0 kg"). */
export type WeightDeltaDirection = "up" | "down" | "flat";
export function formatWeightDelta(
  deltaKg: number,
  units: Units
): { direction: WeightDeltaDirection; signed: string } {
  const value = units === "imperial" ? kgToLb(deltaKg) : deltaKg;
  const unit = unitLabel(units);
  const abs = Math.abs(value);
  if (abs < 0.05) return { direction: "flat", signed: `±0 ${unit}` };
  const sign = value > 0 ? "+" : "−";
  return {
    direction: value > 0 ? "up" : "down",
    signed: `${sign}${round1(abs).toFixed(1)} ${unit}`,
  };
}
