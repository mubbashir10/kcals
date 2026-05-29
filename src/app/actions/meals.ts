"use server";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  instantOnDayInTz,
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

// Move a meal to another calendar day and/or time. `dayKey` is "YYYY-MM-DD"
// and `hhmm` is "HH:mm", both interpreted in the user's timezone.
export async function moveMeal(id: number, dayKey: string, hhmm: string) {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");
  const loggedAt = instantOnDayInTz(tz, dayKey, hhmm);
  await db.meal.updateMany({ where: { id, userId }, data: { loggedAt } });
  revalidateMeals();
}

// Duplicate a meal (and all its foods) onto `dayKey` at `hhmm`. The same day
// is allowed — that's how you clone a meal you eat regularly. Food nutrient
// values are stored as snapshots, so a straight copy stays correct.
export async function copyMeal(id: number, dayKey: string, hhmm: string) {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");
  const loggedAt = instantOnDayInTz(tz, dayKey, hhmm);

  const source = await db.meal.findFirst({
    where: { id, userId },
    include: { foods: { orderBy: { loggedAt: "asc" } } },
  });
  if (!source) throw new Error("Meal not found");

  // Stamp the copied foods at the new time, nudged a millisecond apart so they
  // keep their original order. Staying within the same minute keeps every food
  // on the meal's calendar day (daily-history buckets foods by their own day).
  await db.meal.create({
    data: {
      userId,
      name: source.name,
      loggedAt,
      foods: {
        create: source.foods.map((f, i) => ({
          fdcId: f.fdcId,
          recipeId: f.recipeId,
          name: f.name,
          brand: f.brand,
          grams: f.grams,
          kcal: f.kcal,
          proteinG: f.proteinG,
          carbsG: f.carbsG,
          fatG: f.fatG,
          loggedAt: new Date(loggedAt.getTime() + i),
        })),
      },
    },
  });
  revalidateMeals();
}
