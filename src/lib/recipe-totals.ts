// Shared derivation: a recipe's effective cooked weight, totals, and
// per-100g/per-serving values. Used by the list view, the builder, and
// the search API so they all answer the same way.
//
// `totalWeightG` is optional on Recipe — when the user didn't enter a
// cooked weight, we fall back to the sum of ingredient grams. That's
// fine for recipes whose weight doesn't change much in cooking (a salad
// bowl, a smoothie), and we let the user override when it does (kheer
// reduces, a curry adds liquid).

import {
  ingredientBasis,
  per100gOf,
  scaleFrom100g,
  sumNutrients,
  type Nutrients,
  type Per100Basis,
} from "@/lib/nutrition";

export type RecipeIngredientForTotals = Per100Basis & { grams: number };

export type RecipeForTotals = {
  totalWeightG: number | null;
  servings: number | null;
  ingredients: RecipeIngredientForTotals[];
};

export type RecipeTotals = {
  totalKcal: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  /** What we treat as cooked weight — user-set, else sum of ingredient grams. */
  effectiveTotalWeightG: number;
  /** True when totalWeightG was not explicitly set on the recipe. */
  weightIsDerived: boolean;
  per100Kcal: number;
  per100ProteinG: number;
  per100CarbsG: number;
  per100FatG: number;
  /** Grams per serving, when servings is set and weight > 0. */
  servingG: number | null;
  perServingKcal: number | null;
};

const NO_NUTRIENTS: Nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function computeRecipeTotals(r: RecipeForTotals): RecipeTotals {
  const ingredientsTotalG = r.ingredients.reduce((a, i) => a + i.grams, 0);
  const weightIsDerived = r.totalWeightG == null;
  const effectiveTotalWeightG = r.totalWeightG ?? ingredientsTotalG;

  const totals = sumNutrients(
    r.ingredients.map((i) => scaleFrom100g(ingredientBasis(i), i.grams))
  );
  // A weightless recipe has no per-100g basis to state; zeros keep the shape
  // without implying a density we can't know.
  const per100 = per100gOf(totals, effectiveTotalWeightG) ?? NO_NUTRIENTS;

  const servings = r.servings != null && r.servings > 0 ? r.servings : null;

  return {
    totalKcal: totals.kcal,
    totalProteinG: totals.proteinG,
    totalCarbsG: totals.carbsG,
    totalFatG: totals.fatG,
    effectiveTotalWeightG,
    weightIsDerived,
    per100Kcal: per100.kcal,
    per100ProteinG: per100.proteinG,
    per100CarbsG: per100.carbsG,
    per100FatG: per100.fatG,
    servingG:
      servings != null && effectiveTotalWeightG > 0
        ? effectiveTotalWeightG / servings
        : null,
    perServingKcal: servings != null ? totals.kcal / servings : null,
  };
}
