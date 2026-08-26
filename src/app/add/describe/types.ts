// The draft a described meal becomes once the user has reviewed it.
//
// Kept out of actions.ts because that file carries "use server" and may
// only export async functions — the client needs these shapes too.

import type { AiFoodDraft } from "@/lib/ai-food";
import type { Nutrients } from "@/lib/nutrition";

/** Longest dump we'll read. A day's eating, not a food journal. Lives here
 *  rather than in ai-meal.ts so the textarea can cap itself to the same
 *  number the parser enforces. */
export const MAX_DUMP_CHARS = 2000;

/** An AI-researched food that has no row yet. Saved to the shared library
 *  on confirm, which is the same approval gate tapping an AI search result
 *  goes through. */
export type AiFoodOrigin = Pick<
  AiFoodDraft,
  "aiModel" | "aiSources" | "servingSizeG" | "servingLabel"
>;

export type DescribedItem = {
  /** Source pointer: positive USDA id, -customFoodId, or null for rows
   *  that are only ever snapshots (local reference, recipes, diary
   *  history, unsaved AI). */
  fdcId: number | null;
  /** Set only for the user's own recipe, to link the diary row back. */
  recipeId: number | null;
  name: string;
  /** True for a recipe, whose name is the user's own and must not be
   *  title-cased — the same exception the search flow makes. */
  verbatimName: boolean;
  brand: string | null;
  grams: number;
  /** The basis the server re-scales from. Client-side kcal is display
   *  only — what gets stored is computed here from these four numbers. */
  per100g: Nutrients;
  /** Set when this food isn't in the library yet and must be saved first. */
  ai: AiFoodOrigin | null;
};

export type DescribedMeal = {
  /** Existing meal to append to. Null means "resolve by name on the day",
   *  which is what turns a default-meal placeholder into a real meal. */
  mealId: number | null;
  name: string;
  /** Local "HH:MM" to create the meal at. Null → the current time. */
  timeHhmm: string | null;
  items: DescribedItem[];
};

export type LogDescribedInput = {
  /** Day to log onto, "YYYY-MM-DD". Null means today. */
  dayKey: string | null;
  meals: DescribedMeal[];
};
