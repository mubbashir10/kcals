"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { autoMealNameInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";

export async function createMeal(name?: string) {
  const userId = await requireUserId();
  const trimmed = (name ?? "").trim();
  let resolved = trimmed;
  if (resolved.length === 0) {
    const tz = await getProfileTimezone(userId);
    resolved = autoMealNameInTz(new Date(), tz);
  }
  await db.meal.create({ data: { userId, name: resolved } });
  revalidatePath("/");
}

export async function renameMeal(id: number, name: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  await db.meal.updateMany({
    where: { id, userId },
    data: { name: trimmed.length > 0 ? trimmed : null },
  });
  revalidatePath("/");
}

export async function updateMeal(
  id: number,
  patch: { name?: string; loggedAt?: Date }
) {
  const userId = await requireUserId();
  const data: { name?: string | null; loggedAt?: Date } = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    data.name = trimmed.length > 0 ? trimmed : null;
  }
  if (patch.loggedAt) data.loggedAt = patch.loggedAt;
  await db.meal.updateMany({ where: { id, userId }, data });
  revalidatePath("/");
}

export async function deleteMeal(id: number) {
  const userId = await requireUserId();
  await db.meal.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}
