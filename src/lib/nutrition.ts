// The nutrition four-tuple and the conversions every food path needs: scaling
// a per-100g basis up to a portion, and recovering that basis from an already
// portioned food. One copy means the zero-guard and the rounding behave the
// same wherever a food is scaled.

import { round1 } from "@/lib/utils";

/** Energy + the three macros. The shape of a food row, a portion, or a basis. */
export type Nutrients = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Scale a per-100g basis to `grams`. Non-positive/invalid grams → all zeros. */
export function scaleFrom100g(per100g: Nutrients, grams: number): Nutrients {
  const factor = Number.isFinite(grams) && grams > 0 ? grams / 100 : 0;
  return {
    kcal: per100g.kcal * factor,
    proteinG: per100g.proteinG * factor,
    carbsG: per100g.carbsG * factor,
    fatG: per100g.fatG * factor,
  };
}

/**
 * Recover the per-100g basis of a food already logged at `grams`. Null when
 * grams is missing or zero — quick-add entries carry calories with no weight
 * behind them, so there's no basis to state and callers must not invent one.
 */
export function per100gOf(
  nutrients: Nutrients,
  grams: number
): Nutrients | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const factor = 100 / grams;
  return {
    kcal: nutrients.kcal * factor,
    proteinG: nutrients.proteinG * factor,
    carbsG: nutrients.carbsG * factor,
    fatG: nutrients.fatG * factor,
  };
}

/**
 * Re-scale an already-portioned food from its old gram weight to a new one.
 *
 * Deliberately one division by the gram ratio rather than a trip through
 * per-100g: the two-step form re-associates the arithmetic and lands ~0.2% of
 * whole-gram edits on the other side of a rounding boundary, which would shift
 * persisted values by 0.1 for no reason. Same guard, same result, fewer ops.
 */
export function rescaleToGrams(
  nutrients: Nutrients,
  fromGrams: number,
  toGrams: number
): Nutrients {
  const valid =
    Number.isFinite(fromGrams) &&
    fromGrams > 0 &&
    Number.isFinite(toGrams) &&
    toGrams > 0;
  const factor = valid ? toGrams / fromGrams : 0;
  return {
    kcal: nutrients.kcal * factor,
    proteinG: nutrients.proteinG * factor,
    carbsG: nutrients.carbsG * factor,
    fatG: nutrients.fatG * factor,
  };
}

/**
 * Recipe ingredients store their basis under `per100*` column names rather
 * than the plain nutrient names, so they need a rename before the helpers
 * above apply. This adapter is the one place that mapping lives.
 */
export type Per100Basis = {
  per100Kcal: number;
  per100ProteinG: number;
  per100CarbsG: number;
  per100FatG: number;
};

export function ingredientBasis(i: Per100Basis): Nutrients {
  return {
    kcal: i.per100Kcal,
    proteinG: i.per100ProteinG,
    carbsG: i.per100CarbsG,
    fatG: i.per100FatG,
  };
}

/** Sum a list of nutrient sets. */
export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce<Nutrients>(
    (a, n) => ({
      kcal: a.kcal + n.kcal,
      proteinG: a.proteinG + n.proteinG,
      carbsG: a.carbsG + n.carbsG,
      fatG: a.fatG + n.fatG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
}

/** Round a nutrient set to 1dp — the precision we persist and display at. */
export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: round1(n.kcal),
    proteinG: round1(n.proteinG),
    carbsG: round1(n.carbsG),
    fatG: round1(n.fatG),
  };
}

// A single macro can't sanely exceed this in one logged portion — a larger
// number is a typo or bad client state, not a meal. Per-100g bases cap lower:
// 100 g of anything can't contain more than 100 g of one macro.
export const MAX_MACRO_G = 1000;
export const MAX_MACRO_PER_100G = 100;

// The heaviest single portion we'll accept. Anything more is a typo or bad
// client state — nobody logs five kilos of one food in one row.
export const MAX_PORTION_GRAMS = 5000;

/**
 * Clamp a nutrient into [0, max] at storage precision. Nonsense (NaN, negative)
 * reads as 0 rather than throwing — these come from free-form entry and an
 * unparseable macro means "none given", not "reject the whole food".
 */
export function clampMacroG(n: number, max: number = MAX_MACRO_G): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return round1(Math.min(n, max));
}

/** `clampMacroG` for a text input: blank or unparseable → 0. */
export function parseMacroInput(s: string): number {
  return clampMacroG(parseFloat(s));
}
