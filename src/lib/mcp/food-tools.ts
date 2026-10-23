// MCP tools for the food library: searching every source the app's search
// box uses, the community foods users contribute, and private recipes.

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  createCustomFood,
  deleteCustomFood,
  updateCustomFood,
  type CustomFoodInput,
} from "@/app/actions/custom-foods";
import {
  addRecipeIngredients,
  createRecipe,
  deleteRecipe,
  removeRecipeIngredient,
  updateRecipe,
  updateRecipeIngredientGrams,
} from "@/app/actions/recipes";
import type { CustomFood } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dataTypeLabel } from "@/lib/food-format";
import { searchFoodLadder } from "@/lib/food-search";
import { ingredientBasis, scaleFrom100g } from "@/lib/nutrition";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import { persistableFdcId, round1 } from "@/lib/utils";

import { defineTool, idSchema, macrosOut, nutrientsIn, per100gSchema, servingOut } from "./tool";

// Nutrition for `per_grams` of a food. Bounds that only make sense per 100g
// (≤900 kcal, ≤100g of a macro) are enforced by createCustomFood once it's
// normalized; here only the shape. The extras are optional — unknown stays
// null rather than pretending to be zero.
const customNutritionSchema = z.object({
  kcal: z.number().gt(0),
  protein_g: z.number().min(0).default(0),
  carbs_g: z.number().min(0).default(0),
  fat_g: z.number().min(0).default(0),
  fiber_g: z.number().min(0).optional(),
  sugar_g: z.number().min(0).optional(),
  saturated_fat_g: z.number().min(0).optional(),
  sodium_mg: z.number().min(0).optional(),
  cholesterol_mg: z.number().min(0).optional(),
});

const customFoodFields = {
  name: z.string().trim().min(1).max(120).describe("The food's real name, e.g. 'Greek yogurt, 2% fat'"),
  brand: z.string().trim().max(120).optional(),
  nutrition: customNutritionSchema.describe(
    "Nutrition for `per_grams` grams of the food — per 100g unless per_grams says otherwise"
  ),
  per_grams: z
    .number()
    .gt(0)
    .max(5000)
    .default(100)
    .describe("How many grams `nutrition` describes, e.g. 30 for a label's per-serving column"),
  serving_size_g: z.number().gt(0).max(5000).optional().describe("A typical serving, in grams"),
  serving_label: z.string().trim().max(60).optional().describe("What that serving is called, e.g. '1 cup' or '1 bar'"),
};

// A whole recipe outweighs any one portion — the builder allows up to 50 kg
// of an ingredient (see validateIngredient in app/actions/recipes.ts).
const ingredientGramsSchema = z.number().gt(0).max(50000);

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).optional(),
  grams: ingredientGramsSchema.describe("How much went into the recipe"),
  per_100g: per100gSchema,
  fdc_id: z.number().int().optional().describe("fdc_id from search_foods, if it had one"),
});

const customFoodSchema = z.object(customFoodFields);
type CustomFoodArgs = z.infer<typeof customFoodSchema>;

// The tool speaks "nutrition for N grams"; the table stores per-100g.
function toCustomFoodInput(a: CustomFoodArgs): CustomFoodInput {
  const k = 100 / a.per_grams;
  const per100 = (v: number | undefined) => (v == null ? null : v * k);
  const n = a.nutrition;
  return {
    name: a.name,
    brand: a.brand || null,
    kcal: n.kcal * k,
    proteinG: n.protein_g * k,
    carbsG: n.carbs_g * k,
    fatG: n.fat_g * k,
    fiberG: per100(n.fiber_g),
    sugarG: per100(n.sugar_g),
    saturatedFatG: per100(n.saturated_fat_g),
    sodiumMg: per100(n.sodium_mg),
    cholesterolMg: per100(n.cholesterol_mg),
    // A label's per-serving column is itself the natural serving.
    servingSizeG: a.serving_size_g ?? (a.per_grams !== 100 ? a.per_grams : null),
    servingLabel: a.serving_label || null,
  };
}

function customFoodOut(f: CustomFood) {
  return {
    custom_food_id: f.id,
    fdc_id: -f.id,
    name: f.name,
    brand: f.brand,
    per_100g: {
      ...macrosOut({ kcal: f.kcal, proteinG: f.proteinG ?? 0, carbsG: f.carbsG ?? 0, fatG: f.fatG ?? 0 }),
      fiber_g: f.fiberG,
      sugar_g: f.sugarG,
      saturated_fat_g: f.saturatedFatG,
      sodium_mg: f.sodiumMg,
      cholesterol_mg: f.cholesterolMg,
    },
    serving: servingOut(f),
  };
}

export function registerFoodTools(server: McpServer) {
  defineTool(
    server,
    "search_foods",
    {
      title: "Search foods",
      description:
        "Search every food source kcals has, ranked closest-to-the-user first: foods they've logged before, foods they saved, their recipes, friends' recipes, curated reference foods, community foods, then USDA and Open Food Facts branded products. Each result has per-100g nutrition and, often, a typical serving — pass those to log_foods with the grams eaten.",
      inputSchema: z.object({
        query: z.string().trim().min(2).max(100),
        limit: z.number().int().min(1).max(50).default(20),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ query, limit }, userId) => {
      const results = await searchFoodLadder(userId, query);
      return results.slice(0, limit).map((f) => ({
        name: f.name,
        brand: f.brand,
        source: f.ownerName ? `${f.ownerName}'s recipe` : dataTypeLabel(f.dataType),
        per_100g: macrosOut(f.per100g),
        serving: servingOut(f),
        // Only real references: synthetic display ids (recently logged,
        // reference, Open Food Facts rows) can't be stored anyway.
        fdc_id: f.recipeId != null ? null : persistableFdcId(f.fdcId),
        recipe_id: f.recipeId ?? null,
      }));
    }
  );

  defineTool(
    server,
    "list_my_foods",
    {
      title: "List my custom foods",
      description:
        "Custom foods this user has added to the shared library, with full nutrition and the custom_food_id that update_custom_food and delete_custom_food take.",
      inputSchema: z.object({ query: z.string().trim().max(100).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }, userId) => {
      const foods = await db.customFood.findMany({
        where: {
          createdById: userId,
          name: query ? { contains: query, mode: "insensitive" } : undefined,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return foods.map(customFoodOut);
    }
  );

  defineTool(
    server,
    "create_custom_food",
    {
      title: "Add a food to the library",
      description:
        "Add a food kcals doesn't have yet. It joins the community library every kcals user searches, so search_foods first to avoid duplicates, and use real label or reference values — not guesses. Returns the fdc_id to log it with.",
      inputSchema: customFoodSchema,
    },
    async (args) => {
      const id = await createCustomFood(toCustomFoodInput(args));
      return customFoodOut(await db.customFood.findFirstOrThrow({ where: { id } }));
    }
  );

  defineTool(
    server,
    "update_custom_food",
    {
      title: "Correct a custom food",
      description:
        "Replace the details of a custom food this user added (from list_my_foods). Send the full corrected food — anything left out is cleared.",
      inputSchema: customFoodSchema.extend({ custom_food_id: idSchema }),
      annotations: { idempotentHint: true },
    },
    async ({ custom_food_id, ...args }, userId) => {
      await ownCustomFood(custom_food_id, userId);
      await updateCustomFood(custom_food_id, toCustomFoodInput(args));
      return customFoodOut(await db.customFood.findFirstOrThrow({ where: { id: custom_food_id } }));
    }
  );

  defineTool(
    server,
    "delete_custom_food",
    {
      title: "Delete a custom food",
      description:
        "Remove a custom food this user added from the shared library. Diary entries already logged from it keep their numbers.",
      inputSchema: z.object({ custom_food_id: idSchema }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ custom_food_id }, userId) => {
      await ownCustomFood(custom_food_id, userId);
      await deleteCustomFood(custom_food_id);
    }
  );

  defineTool(
    server,
    "list_recipes",
    {
      title: "List recipes",
      description:
        "The user's own recipes with their nutrition per 100g and per serving. Log one with log_foods using its recipe_id, per_100g and the grams eaten.",
      inputSchema: z.object({ query: z.string().trim().max(100).optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }, userId) => {
      const recipes = await db.recipe.findMany({
        where: {
          userId,
          name: query ? { contains: query, mode: "insensitive" } : undefined,
        },
        orderBy: { createdAt: "desc" },
        include: { ingredients: true },
      });
      return recipes.map((r) => ({ ...recipeSummary(r), ingredient_count: r.ingredients.length }));
    }
  );

  defineTool(
    server,
    "get_recipe",
    {
      title: "Get a recipe",
      description: "One recipe with every ingredient (and the ingredient_id update_recipe takes).",
      inputSchema: z.object({ recipe_id: idSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ recipe_id }, userId) => recipeOut(await ownRecipe(recipe_id, userId))
  );

  defineTool(
    server,
    "create_recipe",
    {
      title: "Create a recipe",
      description:
        "Save a recipe from its ingredients (each with grams and per-100g nutrition, e.g. from search_foods). Set total_weight_g to the cooked weight when cooking changes it; otherwise it's the sum of the ingredients. servings splits it into portions.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(120),
        ingredients: z.array(ingredientSchema).min(1).max(60),
        total_weight_g: z.number().gt(0).max(50000).optional(),
        servings: z.number().gt(0).max(100).optional(),
      }),
    },
    async ({ name, ingredients, total_weight_g, servings }, userId) => {
      const id = await createRecipe({
        name,
        totalWeightG: total_weight_g ?? null,
        servings: servings ?? null,
      });
      await addRecipeIngredients(id, ingredients.map(ingredientInput));
      return recipeOut(await ownRecipe(id, userId));
    }
  );

  defineTool(
    server,
    "update_recipe",
    {
      title: "Edit a recipe",
      description:
        "Edit a recipe: rename it, change its cooked weight or servings (null clears either), add ingredients, change an ingredient's grams, or remove ingredients by ingredient_id (from get_recipe).",
      inputSchema: z.object({
        recipe_id: idSchema,
        name: z.string().trim().min(1).max(120).optional(),
        total_weight_g: z.number().gt(0).max(50000).nullable().optional(),
        servings: z.number().gt(0).max(100).nullable().optional(),
        add_ingredients: z.array(ingredientSchema).max(60).optional(),
        set_ingredient_grams: z
          .array(z.object({ ingredient_id: idSchema, grams: ingredientGramsSchema }))
          .max(60)
          .optional(),
        remove_ingredient_ids: z.array(idSchema).max(60).optional(),
      }),
    },
    async (args, userId) => {
      const recipe = await ownRecipe(args.recipe_id, userId);
      const id = recipe.id;
      if (args.name != null || args.total_weight_g !== undefined || args.servings !== undefined) {
        await updateRecipe(id, {
          name: args.name ?? recipe.name,
          totalWeightG: args.total_weight_g === undefined ? recipe.totalWeightG : args.total_weight_g,
          servings: args.servings === undefined ? recipe.servings : args.servings,
        });
      }
      // The ingredient actions check ownership through the parent recipe, so
      // an id from someone else's recipe is a silent no-op, never a leak.
      for (const { ingredient_id, grams } of args.set_ingredient_grams ?? []) {
        await updateRecipeIngredientGrams(ingredient_id, grams);
      }
      for (const ingredientId of args.remove_ingredient_ids ?? []) {
        await removeRecipeIngredient(ingredientId);
      }
      if (args.add_ingredients?.length) {
        await addRecipeIngredients(id, args.add_ingredients.map(ingredientInput));
      }
      return recipeOut(await ownRecipe(id, userId));
    }
  );

  defineTool(
    server,
    "delete_recipe",
    {
      title: "Delete a recipe",
      description: "Delete a recipe. Diary entries already logged from it keep their numbers.",
      inputSchema: z.object({ recipe_id: idSchema }),
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async ({ recipe_id }) => {
      await deleteRecipe(recipe_id);
    }
  );
}

async function ownCustomFood(id: number, userId: string) {
  const food = await db.customFood.findFirst({
    where: { id, createdById: userId },
    select: { id: true },
  });
  if (!food) throw new Error(`No custom food ${id} added by this user — only foods you added can be changed`);
}

async function ownRecipe(id: number, userId: string) {
  const recipe = await db.recipe.findFirst({
    where: { id, userId },
    include: { ingredients: { orderBy: { position: "asc" } } },
  });
  if (!recipe) throw new Error(`No recipe ${id}`);
  return recipe;
}

type LoadedRecipe = Awaited<ReturnType<typeof ownRecipe>>;

function recipeSummary(r: LoadedRecipe) {
  const t = computeRecipeTotals(r);
  return {
    recipe_id: r.id,
    name: r.name,
    total_weight_g: round1(t.effectiveTotalWeightG),
    servings: r.servings,
    serving_g: t.servingG == null ? null : round1(t.servingG),
    total: macrosOut({
      kcal: t.totalKcal,
      proteinG: t.totalProteinG,
      carbsG: t.totalCarbsG,
      fatG: t.totalFatG,
    }),
    per_100g: macrosOut({
      kcal: t.per100Kcal,
      proteinG: t.per100ProteinG,
      carbsG: t.per100CarbsG,
      fatG: t.per100FatG,
    }),
  };
}

function recipeOut(r: LoadedRecipe) {
  return {
    ...recipeSummary(r),
    ingredients: r.ingredients.map((i) => ({
      ingredient_id: i.id,
      name: i.name,
      brand: i.brand,
      grams: i.grams,
      ...macrosOut(scaleFrom100g(ingredientBasis(i), i.grams)),
    })),
  };
}

function ingredientInput(ing: z.infer<typeof ingredientSchema>) {
  const n = nutrientsIn(ing.per_100g);
  return {
    fdcId: ing.fdc_id ?? null,
    name: ing.name,
    brand: ing.brand || null,
    per100Kcal: n.kcal,
    per100ProteinG: n.proteinG,
    per100CarbsG: n.carbsG,
    per100FatG: n.fatG,
    grams: ing.grams,
  };
}
