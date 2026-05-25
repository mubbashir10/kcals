"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { autoMealNameInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";

export async function createMeal(name?: string) {
  const trimmed = (name ?? "").trim();
  let resolved = trimmed;
  if (resolved.length === 0) {
    const tz = await getProfileTimezone();
    resolved = autoMealNameInTz(new Date(), tz);
  }
  await db.meal.create({ data: { name: resolved } });
  revalidatePath("/");
}

export async function renameMeal(id: number, name: string) {
  const trimmed = name.trim();
  await db.meal.update({
    where: { id },
    data: { name: trimmed.length > 0 ? trimmed : null },
  });
  revalidatePath("/");
}

export async function updateMeal(
  id: number,
  patch: { name?: string; loggedAt?: Date }
) {
  const data: { name?: string | null; loggedAt?: Date } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    data.name = trimmed.length > 0 ? trimmed : null;
  }
  if (patch.loggedAt) data.loggedAt = patch.loggedAt;
  await db.meal.update({ where: { id }, data });
  revalidatePath("/");
}

export async function deleteMeal(id: number) {
  await db.meal.delete({ where: { id } });
  revalidatePath("/");
}
