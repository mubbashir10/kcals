"use server";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  dayKeyInTz,
  instantOnDayInTz,
  instantWithinDayInTz,
  isFutureDayKey,
  startOfDayForDayKey,
} from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { placeholderMealsForDay } from "@/lib/default-meals";
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
  /** Stable identity for React keys + selection, real or not. */
  key: string;
  /** null for a default-meal placeholder — no row exists until it's used. */
  id: number | null;
  name: string | null;
  /** Set only on placeholders: the template time to create the meal at. */
  timeHhmm: string | null;
  loggedAt: string;
  kcal: number;
  foodCount: number;
};

/**
 * Meals on a given calendar day (in the user's tz), for the "move/copy a food
 * into a meal" picker.
 *
 * Today's unused default meals are included as placeholders. They have no row
 * yet — the day list renders them as empty cards — but you must still be able
 * to move food into one, so they're offered here and materialized on use via
 * `ensureMealOnDay`.
 */
export async function listMealsOnDay(dayKey: string): Promise<MealOption[]> {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const todayKey = dayKeyInTz(tz);
  const [meals, defaults] = await Promise.all([
    db.meal.findMany({
      where: { userId, loggedAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { loggedAt: "asc" },
      select: {
        id: true,
        name: true,
        loggedAt: true,
        foods: { select: { kcal: true } },
      },
    }),
    dayKey === todayKey
      ? db.defaultMeal.findMany({
          where: { userId },
          orderBy: { position: "asc" },
          select: { name: true, timeHhmm: true },
        })
      : Promise.resolve([]),
  ]);

  const placeholders = placeholderMealsForDay({
    defaults,
    realMealNames: meals.map((m) => m.name),
    dayKey,
    todayKey,
    tz,
  });

  const options: MealOption[] = [
    ...meals.map((m) => ({
      key: `meal:${m.id}`,
      id: m.id as number | null,
      name: m.name,
      timeHhmm: null,
      loggedAt: m.loggedAt.toISOString(),
      kcal: Math.round(m.foods.reduce((a, f) => a + f.kcal, 0)),
      foodCount: m.foods.length,
    })),
    ...placeholders.map((p) => ({
      key: `default:${p.name}`,
      id: null,
      name: p.name,
      timeHhmm: p.timeHhmm,
      loggedAt: p.loggedAt.toISOString(),
      kcal: 0,
      foodCount: 0,
    })),
  ];
  options.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  return options;
}

/**
 * Resolve a default-meal placeholder to a real meal id, creating the row on
 * first use. Matches on name (case-insensitive), the same rule that decides
 * whether a placeholder is already "satisfied" — so this is idempotent and a
 * double-click can't produce two meals.
 */
export async function ensureMealOnDay(
  dayKey: string,
  name: string,
  timeHhmm: string
): Promise<number> {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");

  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const existing = await db.meal.findFirst({
    where: {
      userId,
      loggedAt: { gte: dayStart, lt: dayEnd },
      name: { equals: name.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const meal = await db.meal.create({
    data: {
      userId,
      name: name.trim(),
      loggedAt: instantOnDayInTz(tz, dayKey, timeHhmm),
    },
    select: { id: true },
  });
  revalidateMeals();
  return meal.id;
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
// and `hhmm` is "HH:mm", both interpreted in the user's timezone. The foods are
// re-stamped a millisecond apart to keep their order within the meal; which day
// they count towards follows the meal (see lib/food-day.ts).
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
