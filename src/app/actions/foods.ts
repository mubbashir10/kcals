"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
