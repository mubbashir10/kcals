"use server";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  instantWithinDayInTz,
  isFutureDayKey,
} from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";
import { revalidateDiary } from "@/lib/revalidate";

function revalidateMeals() {
  revalidateDiary("/diary");
}

export async function createMeal(name?: string, dayKey?: string | null) {
  const userId = await requireUserId();
  const trimmed = (name ?? "").trim();

  let tz: string | undefined;
  let loggedAt: Date | undefined;
  if (dayKey) {
    tz = await getProfileTimezone(userId);
    if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");
    loggedAt = instantWithinDayInTz(tz, dayKey);
  }

  let resolved = trimmed;
  if (resolved.length === 0) {
    tz ??= await getProfileTimezone(userId);
    resolved = autoMealNameInTz(loggedAt ?? new Date(), tz);
  }
  await db.meal.create({ data: { userId, name: resolved, loggedAt } });
  revalidateMeals();
}

export async function renameMeal(id: number, name: string) {
  const userId = await requireUserId();
  const trimmed = name.trim();
  await db.meal.updateMany({
    where: { id, userId },
    data: { name: trimmed.length > 0 ? trimmed : null },
  });
  revalidateMeals();
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
  revalidateMeals();
}

export async function deleteMeal(id: number) {
  const userId = await requireUserId();
  await db.meal.deleteMany({ where: { id, userId } });
  revalidateMeals();
}
