"use server";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  instantOnDayInTz,
  instantWithinDayInTz,
  isFutureDayKey,
  startOfDayForDayKey,
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

// NOTE: this file is "use server" — it may only export async functions, so
// MealOption is intentionally NOT exported (consumers derive it from the
// action's return type). Exporting a type here triggers a runtime 500.
type MealOption = {
  id: number;
  name: string | null;
  loggedAt: string;
  kcal: number;
  foodCount: number;
};

// Meals on a given calendar day (in the user's tz), summarised for the
// "move/copy a food into a meal" picker.
export async function listMealsOnDay(dayKey: string): Promise<MealOption[]> {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const meals = await db.meal.findMany({
    where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { loggedAt: "asc" },
    select: { id: true, name: true, loggedAt: true, foods: { select: { kcal: true } } },
  });
  return meals.map((m) => ({
    id: m.id,
    name: m.name,
    loggedAt: m.loggedAt.toISOString(),
    kcal: Math.round(m.foods.reduce((a, f) => a + f.kcal, 0)),
    foodCount: m.foods.length,
  }));
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
// and `hhmm` is "HH:mm", both interpreted in the user's timezone. The foods
// move with the meal (re-stamped a millisecond apart to keep their order) so
// daily-history, which buckets foods by their own loggedAt, follows along.
export async function moveMeal(id: number, dayKey: string, hhmm: string) {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");
  const loggedAt = instantOnDayInTz(tz, dayKey, hhmm);

  const meal = await db.meal.findFirst({
    where: { id, userId },
    select: { id: true, foods: { orderBy: { loggedAt: "asc" }, select: { id: true } } },
  });
  if (!meal) throw new Error("Meal not found");

  await db.meal.update({
    where: { id: meal.id },
    data: {
      loggedAt,
      foods: {
        update: meal.foods.map((f, i) => ({
          where: { id: f.id },
          data: { loggedAt: new Date(loggedAt.getTime() + i) },
        })),
      },
    },
  });
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
