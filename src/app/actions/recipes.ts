"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

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
    fdcId: Number.isFinite(input.fdcId as number) ? (input.fdcId as number) : null,
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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
