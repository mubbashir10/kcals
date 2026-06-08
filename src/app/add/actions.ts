"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  dayKeyInTz,
  instantOnDayInTz,
  instantWithinDayInTz,
  isFutureDayKey,
  isHhmm,
} from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { titleCase } from "@/lib/food-format";
import { requireUserId } from "@/lib/session";
import { persistableFdcId, round1 } from "@/lib/utils";
import { revalidateDiary } from "@/lib/revalidate";

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
  /**
   * Local time (HH:MM) to pin a newly-created meal at — used when logging into
   * a default-meal placeholder so the meal lands at its scheduled time rather
   * than the current wall-clock. Ignored unless a new meal is created.
   */
  newMealTime?: string | null;
  /**
   * Calendar day (YYYY-MM-DD) for a newly-created meal. `null`/omitted means
   * today. Ignored when appending to an existing meal — that meal already has
   * its day.
   */
  dayKey?: string | null;
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
): Promise<{ mealId: number; createdMeal: boolean }> {
  const userId = await requireUserId();
  const dayKey = options.dayKey ?? null;

  // Everything a new meal needs — timezone, the future-date guard, the
  // pinned instant, the name — is resolved up front. These are reads that
  // don't depend on the mutation, so keeping them out of the transaction
  // below keeps it short and off a second connection. Only needed when we
  // might open a meal (appending to an existing one carries its own day).
  const tz = options.mealId ? null : await getProfileTimezone(userId);
  if (tz && dayKey && isFutureDayKey(tz, dayKey)) {
    throw new Error("Cannot log a future date");
  }
  // A scheduled time (from a default-meal placeholder) pins the new meal at
  // HH:MM on its day; otherwise a past day lands at the current time-of-day,
  // and "today" falls back to now().
  const newMealTime =
    typeof options.newMealTime === "string" && isHhmm(options.newMealTime)
      ? options.newMealTime
      : null;
  let loggedAt: Date | undefined;
  if (tz && newMealTime) {
    loggedAt = instantOnDayInTz(tz, dayKey ?? dayKeyInTz(tz, new Date()), newMealTime);
  } else if (tz && dayKey) {
    loggedAt = instantWithinDayInTz(tz, dayKey);
  }
  const mealName = tz
    ? (typeof options.newMealName === "string" ? options.newMealName.trim() : "") ||
      autoMealNameInTz(loggedAt ?? new Date(), tz)
    : "";

  // Resolving/creating the meal and inserting the food run in one transaction
  // so a failed food insert can never leave behind an empty orphan meal — the
  // exact failure mode that, with a silent client error, made retries pile up
  // duplicate empty meals.
  const result = await db.$transaction(async (tx) => {
    let mealId: number;
    let createdMeal = false;

    if (options.mealId) {
      // Confirm the meal belongs to this user.
      const owned = await tx.meal.findFirst({
        where: { id: options.mealId, userId },
        select: { id: true },
      });
      if (!owned) {
        throw new Error("Meal not found");
      }
      mealId = owned.id;
    } else if (typeof options.newMealName === "string") {
      const meal = await tx.meal.create({
        data: { userId, name: mealName, loggedAt },
      });
      mealId = meal.id;
      createdMeal = true;
    } else {
      // auto-grouping (default). Only joins a recent meal when logging "today" —
      // the 2h window is relative to now, so a past day never matches and we
      // open a fresh meal pinned to that day instead.
      let meal = dayKey
        ? null
        : await tx.meal.findFirst({
            where: {
              userId,
              loggedAt: { gte: new Date(Date.now() - MEAL_JOIN_WINDOW_MS) },
            },
            orderBy: { loggedAt: "desc" },
          });
      if (!meal) {
        meal = await tx.meal.create({
          data: { userId, name: mealName, loggedAt },
        });
        createdMeal = true;
      }
      mealId = meal.id;
    }

    // A recipeId back-link is only valid for the user's own recipe. Friend
    // recipes are logged as snapshots (recipeId null); drop any recipeId we
    // don't own so a crafted request can't attach a diary row to someone
    // else's Recipe.foods. Nutrients on the row stand alone either way.
    let recipeId = input.recipeId ?? null;
    if (recipeId != null) {
      const owned = await tx.recipe.findFirst({
        where: { id: recipeId, userId },
        select: { id: true },
      });
      if (!owned) recipeId = null;
    }

    await tx.food.create({
      // Drop synthetic display-only fdcIds (local "Reference" rows sit below
      // int4's minimum and would throw on insert) — store null for those.
      data: { ...input, recipeId, mealId, fdcId: persistableFdcId(input.fdcId) },
    });

    return { mealId, createdMeal };
  });

  revalidateDiary();
  // No redirect: the user often logs several foods in a row, so the client
  // keeps them on the search page and just closes the dialog. We hand back the
  // meal id so a follow-up add can append to this same meal instead of opening
  // a duplicate one — and whether a meal was created, so the client only
  // refetches the meal picker when there's actually a new chip to show.
  return result;
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

  // Title-case on the way in so AI foods live in the library looking like
  // the manually-entered ones ("Qalmi Date", not "qalmi date") — the model
  // is told to return a lowercase canonical name, so this is the gate that
  // normalizes it for storage.
  const name = titleCase(input.name.trim());
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

