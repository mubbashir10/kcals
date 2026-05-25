"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { autoMealNameInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";

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
 * - If `mealId` is provided, the food joins that meal (validated to belong
 *   to the signed-in user).
 * - Else if `newMealName` is provided, a new meal opens with that name.
 * - Else auto-grouping kicks in: join the most recent meal within the
 *   last 2 hours, or open a new auto-named one.
 */
export async function logFood(
  input: LogFoodInput,
  options: LogFoodOptions = {}
) {
  const userId = await requireUserId();
  let mealId: number;

  if (options.mealId) {
    // Confirm the meal belongs to this user.
    const owned = await db.meal.findFirst({
      where: { id: options.mealId, userId },
      select: { id: true },
    });
    if (!owned) {
      throw new Error("Meal not found");
    }
    mealId = owned.id;
  } else if (typeof options.newMealName === "string") {
    const tz = await getProfileTimezone(userId);
    const meal = await db.meal.create({
      data: {
        userId,
        name: options.newMealName.trim() || autoMealNameInTz(new Date(), tz),
      },
    });
    mealId = meal.id;
  } else {
    // auto-grouping (default)
    const cutoff = new Date(Date.now() - MEAL_JOIN_WINDOW_MS);
    const recent = await db.meal.findFirst({
      where: { userId, loggedAt: { gte: cutoff } },
      orderBy: { loggedAt: "desc" },
    });
    let meal = recent;
    if (!meal) {
      const tz = await getProfileTimezone(userId);
      meal = await db.meal.create({
        data: { userId, name: autoMealNameInTz(new Date(), tz) },
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
