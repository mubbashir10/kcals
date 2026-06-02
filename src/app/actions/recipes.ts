"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { persistableFdcId, round1 } from "@/lib/utils";

export type RecipeIngredientInput = {
  // Positive = USDA fdcId, negative = -customFoodId, null = manual.
  fdcId: number | null;
  name: string;
  brand: string | null;
  per100Kcal: number;
  per100ProteinG: number;
  per100CarbsG: number;
  per100FatG: number;
  grams: number;
};

export type RecipeMetaInput = {
  name: string;
  // Null = "derive from ingredient grams". Set this when cooking changes
  // the weight (reduction, added liquid, etc.).
  totalWeightG: number | null;
  servings: number | null;
};

function validateMeta(input: RecipeMetaInput): RecipeMetaInput {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("Recipe name is required");
  if (name.length > 120) throw new Error("Recipe name is too long");
  let totalWeightG: number | null = null;
  if (input.totalWeightG != null) {
    if (
      !Number.isFinite(input.totalWeightG) ||
      input.totalWeightG <= 0 ||
      input.totalWeightG > 50000
    ) {
      throw new Error("Total weight must be 1–50000g");
    }
    totalWeightG = round1(input.totalWeightG);
  }
  const servings =
    input.servings == null
      ? null
      : Number.isFinite(input.servings) && input.servings > 0 && input.servings <= 100
        ? round1(input.servings)
        : null;
  return { name, totalWeightG, servings };
}

function validateIngredient(input: RecipeIngredientInput): RecipeIngredientInput {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("Ingredient name is required");
  if (!Number.isFinite(input.grams) || input.grams <= 0 || input.grams > 50000) {
    throw new Error("Invalid ingredient grams");
  }
  if (!Number.isFinite(input.per100Kcal) || input.per100Kcal < 0 || input.per100Kcal > 1000) {
    throw new Error("Invalid kcal/100g");
  }
  return {
    // Synthetic display-only ids (local "Reference" rows) fall below int4's
    // minimum and would throw on insert — keep only real, storable refs.
    fdcId: persistableFdcId(input.fdcId),
    name,
    brand: input.brand?.trim() || null,
    per100Kcal: round1(input.per100Kcal),
    per100ProteinG: clampMacro(input.per100ProteinG),
    per100CarbsG: clampMacro(input.per100CarbsG),
    per100FatG: clampMacro(input.per100FatG),
    grams: round1(input.grams),
  };
}

/** Create an empty recipe shell. Ingredients are added separately. */
export async function createRecipe(input: RecipeMetaInput): Promise<number> {
  const userId = await requireUserId();
  const meta = validateMeta(input);
  const recipe = await db.recipe.create({ data: { userId, ...meta } });
  revalidatePath("/recipes");
  return recipe.id;
}

/**
 * Create a blank draft recipe and redirect to its builder. Used by the
 * "New recipe" button so the user lands on a single editable page
 * instead of going through a name-and-weight gate first. The default
 * name is intentionally a placeholder — the builder's inline name input
 * pre-selects it so the user can type over immediately.
 */
export async function createBlankRecipe(): Promise<never> {
  const userId = await requireUserId();
  const recipe = await db.recipe.create({
    data: { userId, name: "Untitled recipe", totalWeightG: null },
  });
  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

/**
 * Update just the name. Used by the builder's inline-editable header so
 * a single rename doesn't have to round-trip every other field.
 */
export async function renameRecipe(id: number, name: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Recipe name is required");
  if (trimmed.length > 120) throw new Error("Recipe name is too long");
  await db.recipe.updateMany({
    where: { id, userId },
    data: { name: trimmed },
  });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

export async function updateRecipe(id: number, input: RecipeMetaInput) {
  const userId = await requireUserId();
  const meta = validateMeta(input);
  await db.recipe.updateMany({ where: { id, userId }, data: meta });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

export async function deleteRecipe(id: number) {
  const userId = await requireUserId();
  await db.recipe.deleteMany({ where: { id, userId } });
  revalidatePath("/recipes");
}

/**
 * Build a recipe from already-logged diary foods and open its builder.
 * Used by the meal card to turn a selection of foods — or a whole meal —
 * into a reusable recipe. Each food's logged nutrients (already scaled to
 * its portion) are converted back to a per-100g snapshot so the recipe
 * builder's portion math works the same as any other ingredient.
 *
 * `foodIds` order is preserved as the ingredient display order. `name`
 * is the source meal's name (falls back to a placeholder), so the recipe
 * lands pre-named and editable in the builder.
 */
export async function createRecipeFromFoods(
  foodIds: number[],
  name: string | null
): Promise<never> {
  const userId = await requireUserId();
  if (foodIds.length === 0) throw new Error("Select at least one food");

  const foods = await db.food.findMany({
    where: { id: { in: foodIds }, meal: { userId } },
    select: {
      id: true,
      fdcId: true,
      name: true,
      brand: true,
      grams: true,
      kcal: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
    },
  });
  if (foods.length === 0) throw new Error("No foods found");

  // findMany doesn't guarantee order; restore the order the caller passed.
  const rank = new Map(foodIds.map((id, i) => [id, i]));
  foods.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));

  const recipeName = (name?.trim() || "Untitled recipe").slice(0, 120);

  // One transaction so a failed ingredient insert doesn't leave an orphan
  // empty recipe in the user's list.
  const recipe = await db.$transaction(async (tx) => {
    const created = await tx.recipe.create({
      data: { userId, name: recipeName, totalWeightG: null },
    });
    await tx.recipeIngredient.createMany({
      data: foods.map((f, i) => {
        // Quick-add rows (grams = 0) carry no real weight; treat them as a
        // 100g basis so the snapshot equals the logged amounts and totals
        // are preserved. We skip validateIngredient's input-sanity caps here:
        // these values come from real logged data, not free-form entry.
        const basis = f.grams > 0 ? f.grams : 100;
        const per100 = (v: number) => round1((v / basis) * 100);
        return {
          recipeId: created.id,
          fdcId: persistableFdcId(f.fdcId),
          name: f.name,
          brand: f.brand,
          per100Kcal: per100(f.kcal),
          per100ProteinG: per100(f.proteinG),
          per100CarbsG: per100(f.carbsG),
          per100FatG: per100(f.fatG),
          grams: round1(basis),
          position: i,
        };
      }),
    });
    return created;
  });

  revalidatePath("/recipes");
  // Outside the transaction: redirect() throws a control-flow signal that
  // would otherwise abort the tx.
  redirect(`/recipes/${recipe.id}`);
}

export async function addRecipeIngredient(
  recipeId: number,
  input: RecipeIngredientInput
): Promise<number> {
  const userId = await requireUserId();
  // Ownership check on the parent recipe before touching ingredients.
  const owned = await db.recipe.findFirst({
    where: { id: recipeId, userId },
    select: { id: true },
  });
  if (!owned) throw new Error("Recipe not found");

  const data = validateIngredient(input);
  // Append at the end. We use a simple max+1; the builder UI is single-user
  // and one-at-a-time so no race to design around.
  const last = await db.recipeIngredient.findFirst({
    where: { recipeId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  const row = await db.recipeIngredient.create({
    data: { recipeId, position, ...data },
  });
  revalidatePath(`/recipes/${recipeId}`);
  return row.id;
}

export async function updateRecipeIngredientGrams(
  ingredientId: number,
  grams: number
) {
  const userId = await requireUserId();
  if (!Number.isFinite(grams) || grams <= 0 || grams > 50000) {
    throw new Error("Invalid grams");
  }
  // Ownership check via the parent recipe.
  const ing = await db.recipeIngredient.findFirst({
    where: { id: ingredientId, recipe: { userId } },
    select: { id: true, recipeId: true },
  });
  if (!ing) return;
  await db.recipeIngredient.update({
    where: { id: ingredientId },
    data: { grams: round1(grams) },
  });
  revalidatePath(`/recipes/${ing.recipeId}`);
}

export async function removeRecipeIngredient(ingredientId: number) {
  const userId = await requireUserId();
  const ing = await db.recipeIngredient.findFirst({
    where: { id: ingredientId, recipe: { userId } },
    select: { id: true, recipeId: true },
  });
  if (!ing) return;
  await db.recipeIngredient.delete({ where: { id: ingredientId } });
  revalidatePath(`/recipes/${ing.recipeId}`);
}

function clampMacro(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return round1(Math.min(n, 100));
}

