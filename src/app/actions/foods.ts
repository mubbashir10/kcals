"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { getProfileTimezone } from "@/lib/clock.server";
import { dayKeyInTz } from "@/lib/clock";
import { revalidateDiary } from "@/lib/revalidate";
import { round1 } from "@/lib/utils";

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
  values: { kcal: number; proteinG: number; carbsG: number; fatG: number }
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
    data: {
      kcal: round1(kcal),
      proteinG: round1(proteinG),
      carbsG: round1(carbsG),
      fatG: round1(fatG),
    },
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

  const factor = grams / food.grams;
  await db.food.update({
    where: { id },
    data: {
      grams,
      kcal: round1(food.kcal * factor),
      proteinG: round1(food.proteinG * factor),
      carbsG: round1(food.carbsG * factor),
      fatG: round1(food.fatG * factor),
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

