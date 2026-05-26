// Shared derivation: a recipe's effective cooked weight, totals, and
// per-100g/per-serving values. Used by the list view, the builder, and
// the search API so they all answer the same way.
//
// `totalWeightG` is optional on Recipe — when the user didn't enter a
// cooked weight, we fall back to the sum of ingredient grams. That's
// fine for recipes whose weight doesn't change much in cooking (a salad
// bowl, a smoothie), and we let the user override when it does (kheer
// reduces, a curry adds liquid).

export type RecipeIngredientForTotals = {
  grams: number;
  per100Kcal: number;
  per100ProteinG: number;
  per100CarbsG: number;
  per100FatG: number;
};

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

export function computeRecipeTotals(r: RecipeForTotals): RecipeTotals {
  const ingredientsTotalG = r.ingredients.reduce((a, i) => a + i.grams, 0);
  const weightIsDerived = r.totalWeightG == null;
  const effectiveTotalWeightG = r.totalWeightG ?? ingredientsTotalG;

  const totalKcal = r.ingredients.reduce(
    (a, i) => a + i.per100Kcal * (i.grams / 100),
    0
  );
  const totalProteinG = r.ingredients.reduce(
    (a, i) => a + i.per100ProteinG * (i.grams / 100),
    0
  );
  const totalCarbsG = r.ingredients.reduce(
    (a, i) => a + i.per100CarbsG * (i.grams / 100),
    0
  );
  const totalFatG = r.ingredients.reduce(
    (a, i) => a + i.per100FatG * (i.grams / 100),
    0
  );

  const factor =
    effectiveTotalWeightG > 0 ? 100 / effectiveTotalWeightG : 0;

  const servingG =
    r.servings != null && r.servings > 0 && effectiveTotalWeightG > 0
      ? effectiveTotalWeightG / r.servings
      : null;
  const perServingKcal =
    r.servings != null && r.servings > 0 ? totalKcal / r.servings : null;

  return {
    totalKcal,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    effectiveTotalWeightG,
    weightIsDerived,
    per100Kcal: totalKcal * factor,
    per100ProteinG: totalProteinG * factor,
    per100CarbsG: totalCarbsG * factor,
    per100FatG: totalFatG * factor,
    servingG,
    perServingKcal,
  };
}
