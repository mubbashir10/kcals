// Free-form meal logging: "peanut butter 16g, dawn multigrain bread 60g and
// honey in breakfast" → real meals with real foods.
//
// Two independent steps, deliberately kept apart:
//
//   1. parseMealDump  — read the text. Purely linguistic: split it into
//      meals, pull out each food with its quantity and unit. The model
//      never invents nutrition here, so a parse mistake is visible and
//      fixable in the review UI before anything is written.
//
//   2. matchParsedItem — bind each parsed item to an actual food row, by
//      running the SAME search ladder the search box uses and letting the
//      model pick from what came back. Only when the ladder is empty does
//      it fall back to generateAiFood, i.e. to invented numbers.
//
// The user's own foods therefore win by construction: their diary history
// and saved foods lead the ladder, so "peanut butter" resolves to the jar
// they logged last week rather than a generic USDA row.
//
// Server-side only. Requires GOOGLE_GENERATIVE_AI_API_KEY.

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { generateAiFood, type AiFoodResult } from "@/lib/ai-food";
import { searchFoodLadder, type FoodSearchResult } from "@/lib/food-search";
import { dataTypeLabel } from "@/lib/food-format";
import { round1 } from "@/lib/utils";
import { MAX_DUMP_CHARS } from "@/app/add/describe/types";

// Reading a sentence is a much smaller job than researching nutrition, so
// the cheap model does it. Kept separate from ai-food.ts's model id: the
// two are free to diverge.
const AI_MEAL_MODEL_ID = "gemini-3.1-flash-lite";

/** Caps on what one dump may produce, so a runaway parse can't flood a day. */
export const MAX_PARSED_MEALS = 8;
export const MAX_PARSED_ITEMS = 40;

// How many ladder rows the matcher gets to choose between. Enough to cover
// a brand hiding behind three near-identical generics, small enough that
// the prompt stays cheap.
const MATCH_CANDIDATES = 12;

// One food, as read out of the text. Exported because the resolve route
// takes exactly this off the wire — parsing through the same schema there
// means the caps and defaults are stated once.
export const ParsedItemSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "The food itself, as a search term: no quantity, no brand, no preparation adjectives. 'multigrain bread', not '2 slices of Dawn multigrain bread'."
    ),
  brand: z
    .string()
    .max(60)
    .nullable()
    .describe(
      "Brand or restaurant, if the text names one — 'Dawn', \"Young's\", 'Nutella'. Null otherwise."
    ),
  quantity: z
    .number()
    .positive()
    .catch(1)
    .describe("How many of the unit below. Default 1 when unstated."),
  unit: z
    .string()
    .max(24)
    .describe(
      "Unit exactly as the user meant it: 'g', 'ml', 'tbsp', 'slice', 'cup', 'piece'. Use 'g' when they gave a gram weight, and 'serving' when they just named the food with no unit."
    ),
  estimateG: z
    .number()
    .nonnegative()
    .catch(0)
    .describe(
      "Your best estimate of the TOTAL weight eaten, in grams, already multiplied out by quantity. For '2 slices of bread' that's about 60. Used only when the unit can't be converted any other way."
    ),
});

const DumpSchema = z.object({
  meals: z.array(
    z.object({
      mealName: z
        .string()
        .nullable()
        .describe(
          "Which meal these foods belong to, e.g. 'Breakfast'. Use one of the user's known meal names verbatim when the text names it. Null when the text doesn't say."
        ),
      timeHhmm: z
        .string()
        .nullable()
        .describe(
          "Local 24-hour time the meal was eaten, 'HH:MM', only if the text states one (e.g. 'at 8am'). Null otherwise."
        ),
      items: z.array(ParsedItemSchema),
    })
  ),
});

export type ParsedItem = z.infer<typeof ParsedItemSchema>;
export type ParsedMeal = z.infer<typeof DumpSchema>["meals"][number];

export type ParseMealContext = {
  /** The meal names available today — the user's defaults plus what they've
   *  already logged — so "breakfast" snaps onto the card that exists. */
  knownMealNames: string[];
  /** Local time now, "HH:MM", for reading "just now" / "an hour ago". */
  nowHhmm: string;
};

/**
 * Read a free-form description of what someone ate into structured meals.
 * Returns [] when the text holds no recognisable food — the caller shows
 * that as "couldn't read that", never as an empty successful parse.
 */
export async function parseMealDump(
  text: string,
  ctx: ParseMealContext
): Promise<ParsedMeal[]> {
  const trimmed = text.trim().slice(0, MAX_DUMP_CHARS);
  if (trimmed.length < 3) return [];

  const known =
    ctx.knownMealNames.length > 0
      ? ctx.knownMealNames.join(", ")
      : "Breakfast, Lunch, Dinner, Snack";

  const { object } = await generateObject({
    model: google(AI_MEAL_MODEL_ID),
    schema: DumpSchema,
    schemaName: "MealDump",
    schemaDescription:
      "Meals and the foods in them, read out of a free-form description of what someone ate.",
    system: [
      "You read a person's description of what they ate and turn it into structured meals.",
      "You are a reader, not a nutritionist: never invent calories or macros, and never add a food the text doesn't mention.",
      "",
      "Rules:",
      `- The user's meal names today are: ${known}. When the text names a meal, reuse that name verbatim (matching case) instead of a synonym.`,
      "- Whenever the text says which meal it was ('for a snack', 'at breakfast', 'before bed'), set mealName — never leave it null just because the wording is casual.",
      "- Only when the text mentions no meal at all, emit a single meal with mealName null.",
      "- Group foods under the meal the text puts them in. A description covering two meals yields two entries.",
      "- Split compound descriptions into one item per food. 'toast with butter and honey' is three items.",
      "- Keep the food's own words in `query` — 'roti', 'daal chawal', 'protein shake' — but strip quantities, brands and cooking adjectives.",
      "- A gram or millilitre figure in the text is authoritative: put the number in `quantity` and 'g'/'ml' in `unit`.",
      "- A food added TO another one — milk in tea, butter on toast, a drizzle of oil, sugar in coffee — is a small amount, not a serving of its own. Give those in grams: a splash of milk in tea is about 30 g, not a cup.",
      "- Ignore anything that isn't food: greetings, feelings, plans, times of day already captured in timeHhmm.",
      `- The local time right now is ${ctx.nowHhmm}.`,
    ].join("\n"),
    prompt: trimmed,
  });

  // Trim to the caps here rather than trusting the model to count. Items
  // are capped across the whole dump, so a 40-item first meal can't push
  // the second one out entirely by arriving first.
  let budget = MAX_PARSED_ITEMS;
  const meals: ParsedMeal[] = [];
  for (const meal of object.meals.slice(0, MAX_PARSED_MEALS)) {
    const items = meal.items
      .filter((i) => i.query.trim().length > 0)
      .slice(0, budget);
    budget -= items.length;
    if (items.length > 0) {
      meals.push({
        mealName: meal.mealName?.trim() || null,
        timeHhmm: meal.timeHhmm?.trim() || null,
        items: items.map(normalizeParsedItem),
      });
    }
    if (budget <= 0) break;
  }
  return meals;
}

/** Trim and default the fields the schema can't express on its own. */
export function normalizeParsedItem(i: ParsedItem): ParsedItem {
  return {
    query: i.query.trim(),
    brand: i.brand?.trim() || null,
    quantity: i.quantity,
    unit: i.unit.trim() || "serving",
    estimateG: round1(i.estimateG),
  };
}

const MatchSchema = z.object({
  matchIndex: z
    .number()
    .int()
    .describe(
      "Index of the candidate that is the same food as the item, or -1 if none of them is."
    ),
});

export type ItemMatch = {
  /** Ladder rows offered for this item — the review UI lets the user
   *  switch between them, so they're returned even when one was picked. */
  candidates: FoodSearchResult[];
  /** Index into `candidates`, or null when the ladder had nothing right. */
  matchIndex: number | null;
  /** Set only when the ladder came up empty-handed: invented numbers,
   *  badged as such, and saved to the food library only on confirm. */
  ai: AiFoodResult | null;
};

/** One line per candidate, dense enough that the model can tell a branded
 *  peanut butter from a generic one without a second call. */
function describeCandidate(f: FoodSearchResult, i: number): string {
  const parts = [`${i}. ${f.name}`];
  if (f.brand) parts.push(`brand: ${f.brand}`);
  parts.push(`source: ${dataTypeLabel(f.dataType)}`);
  parts.push(`${Math.round(f.per100g.kcal)} kcal/100g`);
  if (f.servingSizeG) {
    parts.push(
      `serving: ${round1(f.servingSizeG)} g${f.servingLabel ? ` (${f.servingLabel})` : ""}`
    );
  }
  return parts.join(" · ");
}

/**
 * Bind one parsed item to a food row.
 *
 * Searches brand-first ("Young's peanut butter") because the brand is the
 * discriminating term when there is one, then falls back to the bare food
 * name so a brand we've never heard of doesn't sink the whole item.
 */
export async function matchParsedItem(
  userId: string,
  item: ParsedItem
): Promise<ItemMatch> {
  const bare = item.query.trim();
  const branded = item.brand ? `${item.brand} ${bare}`.trim() : bare;

  let candidates = await searchFoodLadder(userId, branded);
  if (candidates.length === 0 && branded !== bare) {
    candidates = await searchFoodLadder(userId, bare);
  }
  candidates = candidates.slice(0, MATCH_CANDIDATES);

  if (candidates.length === 0) {
    // Nothing we hold matches. This is the same last resort the search box
    // falls back to, and it's the only path that produces made-up numbers.
    return { candidates: [], matchIndex: null, ai: await generateAiFood(branded) };
  }

  let matchIndex: number | null = null;
  try {
    const { object } = await generateObject({
      model: google(AI_MEAL_MODEL_ID),
      schema: MatchSchema,
      schemaName: "FoodMatch",
      schemaDescription:
        "Which of the offered food rows is the food the user described.",
      system: [
        "You match a food someone logged against rows from their food database.",
        "Candidates are ordered by closeness to the user: foods they've logged before and saved come first, then their recipes, then shared databases. Prefer an earlier candidate when two fit equally well.",
        "A candidate matches only if it is the same food. Do not match a different form of it (raw vs cooked, whole vs skimmed, plain vs flavoured) and do not match a different brand when the user named one.",
        "Answer -1 rather than forcing a wrong match — an unmatched item is corrected in one tap, a wrong one is trusted and eaten.",
      ].join("\n"),
      prompt: [
        `Item: ${item.quantity} ${item.unit} of ${bare}`,
        item.brand ? `Brand named by the user: ${item.brand}` : null,
        "",
        "Candidates:",
        ...candidates.map(describeCandidate),
      ]
        .filter((l) => l !== null)
        .join("\n"),
    });
    if (object.matchIndex >= 0 && object.matchIndex < candidates.length) {
      matchIndex = object.matchIndex;
    }
  } catch (err) {
    // A failed pick is recoverable — the review UI shows the candidates
    // and asks the user to choose. Losing the whole item would not be.
    console.error("[ai-meal] match failed", { query: bare }, err);
  }

  // Only research nutrition when the ladder genuinely had no answer. An
  // unmatched item with candidates is a choice for the user, not a gap.
  const ai = matchIndex == null ? await generateAiFood(branded) : null;
  return { candidates, matchIndex, ai };
}
