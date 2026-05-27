"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { autoMealNameInTz } from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";
import { round1 } from "@/lib/utils";

const MEAL_JOIN_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export type LogFoodInput = {
  fdcId: number | null;
  /** Set when this row was logged via a Recipe — links the diary back. */
  recipeId?: number | null;
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

export type ApproveAiFoodInput = {
  name: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSizeG: number | null;
  servingLabel: string | null;
  aiModel: string;
  aiSources: string[];
};

/**
 * Persists an AI-generated food estimate as a CustomFood with
 * source='AI'. Called when the user taps an AI search result — the tap
 * itself is the approval gate. Returns the new row's id so the client
 * can immediately drive the portion dialog against a real DB record.
 *
 * Whether the user actually logs the food after this is their call; the
 * approval is "yes, this lives in our shared library now."
 */
export async function approveAiFood(input: ApproveAiFoodInput): Promise<number> {
  const userId = await requireUserId();

  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) {
    throw new Error("Invalid name");
  }
  if (
    !Number.isFinite(input.kcal) ||
    input.kcal <= 0 ||
    input.kcal > 900
  ) {
    throw new Error("Implausible kcal");
  }

  const food = await db.customFood.create({
    data: {
      createdById: userId,
      name,
      brand: null,
      kcal: round1(input.kcal),
      proteinG: clamp01(input.proteinG, 100),
      carbsG: clamp01(input.carbsG, 100),
      fatG: clamp01(input.fatG, 100),
      servingSizeG:
        input.servingSizeG != null && input.servingSizeG > 0
          ? round1(Math.min(input.servingSizeG, 5000))
          : null,
      servingLabel: input.servingLabel?.trim() || null,
      source: "AI",
      aiModel: input.aiModel,
      // De-dup + cap so a chatty model can't bloat the row.
      aiSources: Array.from(new Set(input.aiSources)).slice(0, 10),
    },
  });

  revalidatePath("/add");
  return food.id;
}

function clamp01(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return round1(Math.min(n, max));
}

