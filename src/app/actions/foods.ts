"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getProfileTimezone } from "@/lib/clock.server";
import { dayKeyInTz } from "@/lib/clock";
import { revalidateDiary } from "@/lib/revalidate";
import { round1 } from "@/lib/utils";
import {
  ingredientBasis,
  rescaleToGrams,
  roundNutrients,
  scaleFrom100g,
  type Nutrients,
} from "@/lib/nutrition";
import { computeRecipeTotals } from "@/lib/recipe-totals";

// A loggedAt for a food landing in `target`: just after the meal's latest
// food, so it sorts last in the list. We only consider foods already on the
// meal's own calendar day — ignoring any stray food on another day — so the
// new row both appends to the end AND buckets onto the meal's day (which is
// what daily-history/calendar group foods by). Anchors to the meal's own
// instant when it has no same-day foods yet.
function landingInstant(
  target: { loggedAt: Date; foods: { loggedAt: Date }[] },
  tz: string
): Date {
  const mealDay = dayKeyInTz(tz, target.loggedAt);
  let latest = target.loggedAt.getTime();
  for (const f of target.foods) {
    const t = f.loggedAt.getTime();
    if (t > latest && dayKeyInTz(tz, f.loggedAt) === mealDay) latest = t;
  }
  return new Date(latest + 1);
}

// Directly set kcal (and optional macros) on a quick-add food row. Used by
// the edit UI in MealCard when food.grams === 0 — there's no portion to
// scale from, so every nutrient is entered directly.
export async function updateFoodQuickAdd(
  id: number,
  values: Nutrients
) {
  const { kcal, proteinG, carbsG, fatG } = values;
  if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 10000) {
    throw new Error("Invalid kcal");
  }
  for (const m of [proteinG, carbsG, fatG]) {
    if (!Number.isFinite(m) || m < 0 || m > 1000) {
      throw new Error("Invalid macro");
    }
  }
  const userId = await requireUserId();

  const food = await db.food.findFirst({
    where: { id, meal: { userId } },
    select: { id: true },
  });
  if (!food) return;

  await db.food.update({
    where: { id },
    data: roundNutrients(values),
  });
  revalidatePath("/");
}

export async function updateFoodGrams(id: number, grams: number) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
    throw new Error("Invalid serving size");
  }
  const userId = await requireUserId();

  // Ownership check via the parent meal.
  const food = await db.food.findFirst({
    where: { id, meal: { userId } },
  });
  if (!food) return;
  // No weight behind the calories means no basis to rescale from, and dividing
  // by 0 here would write Infinity (see per100gOf). The editor routes these to
  // updateFoodQuickAdd; refuse rather than corrupt the row if one lands here.
  if (food.grams <= 0) throw new Error("Cannot resize a quick-add entry");

  await db.food.update({
    where: { id },
    data: {
      grams,
      ...roundNutrients(rescaleToGrams(food, food.grams, grams)),
    },
  });
  revalidatePath("/");
}

export async function deleteFood(id: number) {
  return deleteFoods([id]);
}

export async function deleteFoods(foodIds: number[]) {
  const userId = await requireUserId();
  if (foodIds.length === 0) return;
  await db.food.deleteMany({ where: { id: { in: foodIds }, meal: { userId } } });
  // Bulk delete is reachable from the meal card on every diary surface, so
  // refresh them all — not just "/".
  revalidateDiary("/diary");
}

// Replace a logged recipe with one diary row per ingredient, scaled to the
// portion that was logged. e.g. a 300g serving of a 1200g recipe explodes
// into each ingredient at a quarter of the amount that went into the recipe.
// The original recipe row is removed in the same transaction. New rows are
// plain foods (no recipeId) so they edit independently from here on.
export async function explodeRecipeFood(foodId: number) {
  const userId = await requireUserId();

  const food = await db.food.findFirst({
    where: { id: foodId, meal: { userId } },
    select: {
      id: true,
      mealId: true,
      recipeId: true,
      grams: true,
      kcal: true,
      loggedAt: true,
    },
  });
  if (!food || food.recipeId == null) return;

  const recipe = await db.recipe.findFirst({
    where: { id: food.recipeId, userId },
    select: {
      totalWeightG: true,
      servings: true,
      ingredients: {
        orderBy: { position: "asc" },
        select: {
          fdcId: true,
          name: true,
          brand: true,
          per100Kcal: true,
          per100ProteinG: true,
          per100CarbsG: true,
          per100FatG: true,
          grams: true,
        },
      },
    },
  });
  // Recipe deleted, or has no ingredients to expand into — leave the row as is.
  if (!recipe || recipe.ingredients.length === 0) return;

  const totals = computeRecipeTotals(recipe);
  // What fraction of the whole recipe this row represents. Prefer the logged
  // weight against the recipe's cooked weight; fall back to the kcal ratio for
  // quick-add rows (grams = 0) or a weightless recipe.
  const fraction =
    food.grams > 0 && totals.effectiveTotalWeightG > 0
      ? food.grams / totals.effectiveTotalWeightG
      : totals.totalKcal > 0
        ? food.kcal / totals.totalKcal
        : 1;

  // Keep the exploded rows in the original's slot: same base instant, then
  // +1ms per ingredient so they stay in recipe order.
  const base = food.loggedAt.getTime();

  await db.$transaction([
    ...recipe.ingredients.map((ing, i) => {
      const grams = ing.grams * fraction;
      return db.food.create({
        data: {
          mealId: food.mealId,
          fdcId: ing.fdcId,
          name: ing.name,
          brand: ing.brand,
          grams: round1(grams),
          ...roundNutrients(scaleFrom100g(ingredientBasis(ing), grams)),
          loggedAt: new Date(base + i),
        },
      });
    }),
    db.food.delete({ where: { id: food.id } }),
  ]);

  revalidateDiary("/diary");
}

// Shared lookup: the owned foods (in the order the caller passed) and the
// destination meal with just enough to compute where rows should land.
async function loadFoodsAndTarget(
  foodIds: number[],
  targetMealId: number,
  userId: string
) {
  const [foods, target] = await Promise.all([
    db.food.findMany({ where: { id: { in: foodIds }, meal: { userId } } }),
    db.meal.findFirst({
      where: { id: targetMealId, userId },
      select: {
        id: true,
        loggedAt: true,
        // All food timestamps — landingInstant needs the latest one on the
        // meal's own day, which may not be the single most-recent food.
        foods: { select: { loggedAt: true } },
      },
    }),
  ]);
  if (!target) throw new Error("Target meal not found");
  // findMany doesn't guarantee order; restore the caller's order so the moved
  // rows keep their relative sequence in the destination.
  const rank = new Map(foodIds.map((id, i) => [id, i]));
  foods.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return { foods, target };
}

// Move foods into another (existing) meal — same day or a different one. They
// adopt the target meal's day via fresh, sequential loggedAt stamps so their
// order is preserved.
export async function moveFoods(foodIds: number[], targetMealId: number) {
  const userId = await requireUserId();
  if (foodIds.length === 0) return;
  const { foods, target } = await loadFoodsAndTarget(foodIds, targetMealId, userId);
  const movable = foods.filter((f) => f.mealId !== target.id); // already-there = no-op
  if (movable.length === 0) return;
  const tz = await getProfileTimezone(userId);
  const base = landingInstant(target, tz).getTime();
  await db.$transaction(
    movable.map((f, i) =>
      db.food.update({
        where: { id: f.id },
        data: { mealId: target.id, loggedAt: new Date(base + i) },
      })
    )
  );
  revalidateDiary("/diary");
}

// Duplicate foods into another (existing) meal.
export async function copyFoods(foodIds: number[], targetMealId: number) {
  const userId = await requireUserId();
  if (foodIds.length === 0) return;
  const { foods, target } = await loadFoodsAndTarget(foodIds, targetMealId, userId);
  const tz = await getProfileTimezone(userId);
  const base = landingInstant(target, tz).getTime();
  await db.$transaction(
    foods.map((f, i) =>
      db.food.create({
        data: {
          mealId: target.id,
          fdcId: f.fdcId,
          recipeId: f.recipeId,
          name: f.name,
          brand: f.brand,
          grams: f.grams,
          kcal: f.kcal,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          loggedAt: new Date(base + i),
        },
      })
    )
  );
  revalidateDiary("/diary");
}

