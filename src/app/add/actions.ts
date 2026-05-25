"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { autoMealNameInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";

const MEAL_JOIN_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export type LogFoodInput = {
  fdcId: number | null;
  name: string;
  brand: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type LogFoodOptions = {
  /** Append to this existing meal. */
  mealId?: number | null;
  /** Create a brand-new meal with this name (only used when mealId is null/undefined). */
  newMealName?: string | null;
};

/**
 * Adds a food to the user's log.
 * - If `mealId` is provided, the food joins that meal.
 * - Else if `newMealName` is provided, a new meal opens with that name.
 * - Else auto-grouping kicks in: join the most recent meal within the
 *   last 2 hours, or open a new auto-named one.
 */
export async function logFood(
  input: LogFoodInput,
  options: LogFoodOptions = {}
) {
  let mealId: number;

  if (options.mealId) {
    mealId = options.mealId;
  } else if (typeof options.newMealName === "string") {
    const tz = await getProfileTimezone();
    const meal = await db.meal.create({
      data: {
        name: options.newMealName.trim() || autoMealNameInTz(new Date(), tz),
      },
    });
    mealId = meal.id;
  } else {
    // auto-grouping (default)
    const cutoff = new Date(Date.now() - MEAL_JOIN_WINDOW_MS);
    const recent = await db.meal.findFirst({
      where: { loggedAt: { gte: cutoff } },
      orderBy: { loggedAt: "desc" },
    });
    let meal = recent;
    if (!meal) {
      const tz = await getProfileTimezone();
      meal = await db.meal.create({
        data: { name: autoMealNameInTz(new Date(), tz) },
      });
    }
    mealId = meal.id;
  }

  await db.food.create({
    data: { mealId, ...input },
  });

  revalidatePath("/");
  redirect("/");
}

