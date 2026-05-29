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
  const userId = await requireUserId();
  await db.food.deleteMany({ where: { id, meal: { userId } } });
  revalidatePath("/");
}

// Shared lookup: the food (ownership-checked) and the destination meal with
// just enough to compute where the row should land.
async function loadFoodAndTarget(foodId: number, targetMealId: number, userId: string) {
  const [food, target] = await Promise.all([
    db.food.findFirst({ where: { id: foodId, meal: { userId } } }),
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
  if (!food || !target) throw new Error("Food or target meal not found");
  return { food, target };
}

// Move a single food into another (existing) meal — same day or a different
// one. The food adopts the target meal's day via a fresh loggedAt.
export async function moveFood(foodId: number, targetMealId: number) {
  const userId = await requireUserId();
  const { food, target } = await loadFoodAndTarget(foodId, targetMealId, userId);
  if (food.mealId === target.id) return; // already there — no-op
  const tz = await getProfileTimezone(userId);
  await db.food.update({
    where: { id: food.id },
    data: { mealId: target.id, loggedAt: landingInstant(target, tz) },
  });
  revalidateDiary("/diary");
}

// Duplicate a single food into another (existing) meal.
export async function copyFood(foodId: number, targetMealId: number) {
  const userId = await requireUserId();
  const { food, target } = await loadFoodAndTarget(foodId, targetMealId, userId);
  const tz = await getProfileTimezone(userId);
  await db.food.create({
    data: {
      mealId: target.id,
      fdcId: food.fdcId,
      recipeId: food.recipeId,
      name: food.name,
      brand: food.brand,
      grams: food.grams,
      kcal: food.kcal,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      loggedAt: landingInstant(target, tz),
    },
  });
  revalidateDiary("/diary");
}

