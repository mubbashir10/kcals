"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";

export async function updateFoodGrams(id: number, grams: number) {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 5000) {
    throw new Error("Invalid serving size");
  }
  const food = await db.food.findUnique({ where: { id } });
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
  await db.food.delete({ where: { id } });
  revalidatePath("/");
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
