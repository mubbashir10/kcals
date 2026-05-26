// AI fallback for food search. Runs only when USDA + OFF + community
// queries all return zero rows — see /api/foods/search/ai.
//
// Uses Gemini Flash via the Google Generative AI API directly, in two
// steps:
//   1. generateText with the built-in googleSearch tool, grounded → a
//      free-form answer plus source URLs.
//   2. generateObject on that answer to extract typed per-100g macros.
//
// Why two calls: Gemini does not allow the built-in `googleSearch` tool
// in the same request as a response schema or function tool. Asking for
// both at once 400s, so we split: ground first, then structure. Costs a
// second small call but is the only reliable shape today.
//
// Server-side only — never import from a client component. Requires
// GOOGLE_GENERATIVE_AI_API_KEY (get one at https://aistudio.google.com).

import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const AI_FOOD_MODEL_ID = "gemini-3.1-flash-lite";

// Synthetic-id range for AI results that have NOT yet been saved to the
// DB. Lives below the OFF floor in openfoodfacts.ts (−1_000_000_000) so
// the two never collide. Approval moves the row into CustomFood with a
// real id, and the result is then surfaced with `-customFood.id` like
// any other community entry.
const AI_PREVIEW_ID = -2_000_000_000;

const NutritionSchema = z.object({
  // The model's normalized, search-corroborated name for the food. We
  // store this instead of the raw query so "biryani" doesn't end up as
  // "biriyani" or "biryani recipe" in the DB.
  canonicalName: z
    .string()
    .describe("Plain, lowercase food name as it'd appear in a recipe book."),

  // Per-100g macros. Should match the values cited in the grounded text.
  kcal: z.number().describe("Energy per 100g, in kcal."),
  proteinG: z.number().describe("Protein per 100g, in grams."),
  carbsG: z.number().describe("Carbohydrates per 100g, in grams."),
  fatG: z.number().describe("Fat per 100g, in grams."),

  // Optional default serving. Helps the portion dialog default to "1
  // chapati" instead of always "100g" for foods that have a clear
  // single-portion convention.
  servingSizeG: z
    .number()
    .nullable()
    .describe(
      "Typical single-serving size in grams, or null if there is no obvious one (e.g. raw ingredients)."
    ),
  servingLabel: z
    .string()
    .nullable()
    .describe(
      "Human label for one serving, e.g. '1 chapati', '1 cup', '1 bowl'. Null if not applicable."
    ),

  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "How confident the grounded text made you. 'low' if the numbers vary wildly across sources or the food is ambiguous."
    ),

  // Set when the grounded text says no reliable nutrition data was
  // found, or the query isn't a real food. The route then returns null
  // instead of showing a fabricated result.
  notFound: z
    .boolean()
    .describe(
      "true when the search returned no usable nutrition info for this food (e.g. obscure local brand with no online presence)."
    ),
});

export type AiFoodNutrition = z.infer<typeof NutritionSchema>;

export type AiFoodResult = {
  /** Stable synthetic id for this preview row. Negative, never collides. */
  fdcId: number;
  name: string;
  brand: null;
  /** Tag used by the client to render the AI badge. */
  dataType: "AI";
  per100g: {
    kcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  servingSizeG: number | null;
  servingLabel: string | null;
  /** Model id we used. Persisted onto the CustomFood row on approval. */
  aiModel: string;
  /** URLs the model grounded against. Persisted for provenance. */
  aiSources: string[];
  /** Forwarded so the UI can warn on low-confidence numbers. */
  aiConfidence: AiFoodNutrition["confidence"];
};

/**
 * Ask Gemini for per-100g nutrition for the given query, grounded with
 * Google Search. Returns a single AiFoodResult on success, or null when
 * the model declines / errors. The caller is responsible for showing
 * the result to the user and only persisting it on explicit approval.
 */
export async function generateAiFood(
  query: string
): Promise<AiFoodResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  try {
    // Step 1 — grounded research. Free text + source URLs.
    const grounded = await generateText({
      model: google(AI_FOOD_MODEL_ID),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      system:
        "You research nutrition information for foods. Always call google_search to find authoritative per-100g nutrition data. Prefer USDA, official nutrition databases, and brand-published label values over recipe blogs. If the food appears to be a real product or dish, summarize: canonical name, per-100g kcal/protein/carbs/fat, typical serving size, and how confident the sources made you. If no reliable info exists (obscure local brand, made-up name, etc.), say so explicitly.",
      prompt: `Research per-100g nutrition for: ${trimmed}`,
    });

    const groundedText = grounded.text?.trim() ?? "";
    if (groundedText.length === 0) {
      console.warn("[ai-food] grounded step returned empty text", { query });
      return null;
    }

    const sources = (grounded.sources ?? [])
      .filter((s) => s.sourceType === "url")
      .map((s) => s.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 10);

    // Step 2 — structure the grounded text. No tools, no search; just
    // schema-enforced extraction so we get clean numbers back.
    const { object: data } = await generateObject({
      model: google(AI_FOOD_MODEL_ID),
      schema: NutritionSchema,
      schemaName: "FoodNutrition",
      schemaDescription:
        "Per-100g nutrition for a single food item, extracted from grounded research.",
      system:
        "Extract per-100g nutrition values from the research notes. Use the numbers exactly as cited. If the notes say no reliable info was found, set notFound=true and leave numeric fields at 0.",
      prompt: `Research notes for "${trimmed}":\n\n${groundedText}`,
    });

    if (data.notFound || data.kcal <= 0) {
      return null;
    }

    return {
      fdcId: AI_PREVIEW_ID,
      name: data.canonicalName || trimmed,
      brand: null,
      dataType: "AI",
      per100g: {
        kcal: Math.max(0, data.kcal),
        proteinG: Math.max(0, data.proteinG),
        carbsG: Math.max(0, data.carbsG),
        fatG: Math.max(0, data.fatG),
      },
      servingSizeG: data.servingSizeG,
      servingLabel: data.servingLabel,
      aiModel: AI_FOOD_MODEL_ID,
      aiSources: sources,
      aiConfidence: data.confidence,
    };
  } catch (err) {
    console.error("[ai-food] generation failed", err);
    return null;
  }
}
