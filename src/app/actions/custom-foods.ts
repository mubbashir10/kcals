"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export type CustomFoodInput = {
  name: string;
  brand: string | null;

  // Per-100g — kcal required, the rest optional
  kcal: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;

  servingSizeG: number | null;
  servingLabel: string | null;
};

function bound(
  value: number | null,
  min: number,
  max: number,
  label: string
): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}`);
  }
  return round1(value);
}

function validate(input: CustomFoodInput) {
  const name = input.name.trim();
  if (name.length === 0) throw new Error("Name is required");
  if (name.length > 120) throw new Error("Name is too long");

  if (!Number.isFinite(input.kcal) || input.kcal <= 0 || input.kcal > 900) {
    throw new Error("Calories must be 1–900 kcal/100g");
  }

  return {
    name,
    brand: input.brand?.trim() || null,
    kcal: round1(input.kcal),
    proteinG: bound(input.proteinG, 0, 100, "protein"),
    carbsG: bound(input.carbsG, 0, 100, "carbs"),
    fatG: bound(input.fatG, 0, 100, "fat"),
    fiberG: bound(input.fiberG, 0, 100, "fiber"),
    sugarG: bound(input.sugarG, 0, 100, "sugar"),
    saturatedFatG: bound(input.saturatedFatG, 0, 100, "saturated fat"),
    sodiumMg: bound(input.sodiumMg, 0, 100000, "sodium"),
    cholesterolMg: bound(input.cholesterolMg, 0, 5000, "cholesterol"),
    servingSizeG: bound(input.servingSizeG, 0.1, 5000, "serving size"),
    servingLabel: input.servingLabel?.trim() || null,
  };
}

export async function createCustomFood(input: CustomFoodInput) {
  const createdById = await requireUserId();
  const data = validate(input);
  const food = await db.customFood.create({
    data: { createdById, ...data },
  });
  revalidatePath("/");
  revalidatePath("/add");
  return food.id;
}

/** Only the contributor can edit their own entry. */
export async function updateCustomFood(id: number, input: CustomFoodInput) {
  const createdById = await requireUserId();
  const data = validate(input);
  await db.customFood.updateMany({
    where: { id, createdById },
    data,
  });
  revalidatePath("/");
  revalidatePath("/add");
}

/** Only the contributor can delete their own entry. */
export async function deleteCustomFood(id: number) {
  const createdById = await requireUserId();
  await db.customFood.deleteMany({ where: { id, createdById } });
  revalidatePath("/");
  revalidatePath("/add");
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
