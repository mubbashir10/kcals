// Turning "2 slices" or "1 tbsp" into grams.
//
// Free-form logging gives a quantity and a unit; the diary stores grams.
// Three ladders, tried in order, so the most trustworthy source wins:
//   1. The unit is already a weight or volume — pure arithmetic.
//   2. The matched food has a serving convention that fits the unit —
//      "1 slice = 30 g" from the label.
//   3. Whatever the parser estimated from the text alone.
//
// `basis` is carried alongside so the review UI can say where a number
// came from; a user who disagrees edits the grams directly.

import { extractUnitName } from "@/lib/food-format";
import { round1 } from "@/lib/utils";

/** Where a gram figure came from. Shown next to the number in review. */
export type GramsBasis = "stated" | "serving" | "estimated";

export type GramsResolution = {
  grams: number;
  basis: GramsBasis;
  /** Human explanation, e.g. "2 × 30 g slice". Null for a stated weight. */
  detail: string | null;
};

// Weight/volume units we can convert without knowing the food. Volume is
// treated as 1 g/ml — right for water, milk and most drinks, and close
// enough for the rest that the alternative (refusing to convert) is worse.
const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  gm: 1,
  gramme: 1,
  kg: 1000,
  kilo: 1000,
  kilogram: 1000,
  mg: 0.001,
  oz: 28.35,
  ounce: 28.35,
  lb: 453.59,
  pound: 453.59,
  ml: 1,
  millilitre: 1,
  milliliter: 1,
  cc: 1,
  l: 1000,
  litre: 1000,
  liter: 1000,
};

// Units that mean "one of whatever this food comes as" — they carry no
// size of their own, so they only resolve against the food's own serving.
const GENERIC_UNITS = new Set([
  "",
  "serving",
  "portion",
  "piece",
  "pc",
  "unit",
  "item",
  "each",
  "no",
]);

/** Lowercase, de-pluralise, strip punctuation: "Slices." → "slice". */
export function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase().replace(/[.\s]+$/, "");
  if (/(?:sh|ch|s|x|z)es$/.test(u)) return u.slice(0, -2);
  if (u.length > 1 && u.endsWith("s")) return u.slice(0, -1);
  return u;
}

/**
 * Resolve a quantity + unit against the food it was matched to.
 *
 * `estimateG` is the parser's own guess for the whole item (already
 * multiplied out by quantity) and is the floor of last resort — it's used
 * only when neither the unit nor the food says anything definite.
 */
export function resolveGrams(
  input: { quantity: number; unit: string; estimateG: number },
  food: { servingSizeG: number | null; servingLabel: string | null } | null
): GramsResolution {
  const qty =
    Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : 1;
  const unit = normalizeUnit(input.unit);

  const perUnit = UNIT_GRAMS[unit];
  if (perUnit != null) {
    return {
      grams: round1(qty * perUnit),
      basis: "stated",
      // Only worth explaining when a conversion actually happened.
      detail: perUnit === 1 ? null : `${qty} ${unit} → g`,
    };
  }

  const serving = food?.servingSizeG;
  if (serving != null && serving > 0) {
    const label = food?.servingLabel ? extractUnitName(food.servingLabel) : "";
    const labelUnit = normalizeUnit(label);
    // A generic unit takes the food's serving whatever it's called; a named
    // one ("slice") has to agree with the label, or we'd silently call a
    // slice a cup.
    if (GENERIC_UNITS.has(unit) || (labelUnit.length > 0 && labelUnit === unit)) {
      return {
        grams: round1(qty * serving),
        basis: "serving",
        detail: `${qty} × ${round1(serving)} g ${labelUnit || "serving"}`,
      };
    }
  }

  const estimate =
    Number.isFinite(input.estimateG) && input.estimateG > 0
      ? input.estimateG
      : qty * 100;
  return {
    grams: round1(estimate),
    basis: "estimated",
    detail: unit ? `${qty} ${unit}, estimated` : "estimated",
  };
}
