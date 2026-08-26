"use server";

import { db } from "@/lib/db";
import {
  autoMealNameInTz,
  dayKeyInTz,
  isDayKey,
  isFutureDayKey,
  isHhmm,
  timeInputValueInTz,
} from "@/lib/clock";
import { getProfileTimezone } from "@/lib/clock.server";
import { saveAiFood } from "@/lib/ai-food";
import { MAX_PARSED_ITEMS, MAX_PARSED_MEALS } from "@/lib/ai-meal";
import { titleCase } from "@/lib/food-format";
import { resolveMealOnDay } from "@/lib/meal-target";
import {
  clampMacroG,
  MAX_MACRO_G,
  MAX_PORTION_GRAMS,
  roundNutrients,
  scaleFrom100g,
} from "@/lib/nutrition";
import { ownedRecipeIds } from "@/lib/recipe-link";
import { requireUserId } from "@/lib/session";
import { revalidateDiary } from "@/lib/revalidate";
import { persistableFdcId, round1 } from "@/lib/utils";
import type { DescribedItem, LogDescribedInput } from "./types";

/**
 * Write a reviewed free-form dump into the diary.
 *
 * The meal each group lands in is resolved by name on the day, so a group
 * called "Breakfast" fills the user's Breakfast placeholder rather than
 * opening a second card next to it — the placeholder becomes a real meal
 * at its scheduled time the moment food goes into it.
 *
 * Nutrients are recomputed here from `per100g × grams`. The client's
 * displayed kcal never reaches the database.
 */
export async function logDescribedMeals(
  input: LogDescribedInput
): Promise<void> {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);

  const dayKey =
    typeof input.dayKey === "string" && isDayKey(input.dayKey)
      ? input.dayKey
      : dayKeyInTz(tz);
  if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");

  const nowHhmm = timeInputValueInTz(new Date(), tz);

  // Trim to the same caps the parser emits under, so the two can't disagree
  // about how much one dump may write.
  const meals = (input.meals ?? []).slice(0, MAX_PARSED_MEALS);
  let remaining = MAX_PARSED_ITEMS;
  const groups = meals
    .map((m) => {
      const items = (m.items ?? []).slice(0, remaining);
      remaining -= items.length;
      return { ...m, items };
    })
    .filter((m) => m.items.length > 0);
  const allItems = groups.flatMap((g) => g.items);

  // Everything that only reads runs first, off the transaction and in
  // parallel: the two ownership checks, and the AI foods that need a
  // library row before a diary row can point at one. Holding a transaction
  // open across model-latency inserts would be far worse than the harmless
  // orphan an interrupted commit can leave behind.
  const [ownedMealIds, ownedRecipes, savedAiIds] = await Promise.all([
    ownedMealIdSet(
      userId,
      groups.map((g) => g.mealId)
    ),
    ownedRecipeIds(
      db,
      userId,
      allItems.map((i) => i.recipeId)
    ),
    saveAiFoods(userId, allItems),
  ]);

  // One transaction for the whole dump: a half-written breakfast is worse
  // than a failed one, and the retry is a single tap.
  await db.$transaction(async (tx) => {
    // Stamped in order so foods keep the sequence they were described in.
    // Which day a food belongs to comes from its meal, never from this
    // (see lib/food-day.ts), so "now" is safe on a backfilled day.
    let stamp = Date.now();

    for (const meal of groups) {
      let mealId: number;
      if (meal.mealId != null) {
        if (!ownedMealIds.has(meal.mealId)) throw new Error("Meal not found");
        mealId = meal.mealId;
      } else {
        const name =
          meal.name?.trim().slice(0, 60) || autoMealNameInTz(new Date(), tz);
        const resolved = await resolveMealOnDay(tx, {
          userId,
          tz,
          dayKey,
          name,
          timeHhmm:
            typeof meal.timeHhmm === "string" && isHhmm(meal.timeHhmm)
              ? meal.timeHhmm
              : nowHhmm,
        });
        mealId = resolved.id;
      }

      const rows = meal.items
        .map((item) => {
          const raw = item.name?.trim().slice(0, 200);
          if (!raw) return null;

          const grams = Math.min(
            MAX_PORTION_GRAMS,
            Math.max(0, round1(Number(item.grams) || 0))
          );
          const scaled = roundNutrients(scaleFrom100g(item.per100g, grams));
          // A just-saved AI food now has a real library row to point at.
          const savedId = savedAiIds.get(item);

          return {
            mealId,
            fdcId: savedId != null ? -savedId : persistableFdcId(item.fdcId),
            // A back-link is only valid for the user's own recipe; a
            // friend's is logged as a snapshot.
            recipeId:
              item.recipeId != null && ownedRecipes.has(item.recipeId)
                ? item.recipeId
                : null,
            // Normalized on the way in so the diary reads consistently,
            // with recipes exempt — titleCase mangles capitalization a
            // user chose.
            name: item.verbatimName ? raw : titleCase(raw),
            brand: item.brand?.trim().slice(0, 120) || null,
            grams,
            kcal: clampMacroG(scaled.kcal, MAX_MACRO_G * 10),
            proteinG: clampMacroG(scaled.proteinG),
            carbsG: clampMacroG(scaled.carbsG),
            fatG: clampMacroG(scaled.fatG),
            loggedAt: new Date(stamp++),
          };
        })
        .filter((r) => r !== null);

      // One INSERT per meal rather than one per food — nothing reads the
      // created rows back, and a 40-item dump was 40 round-trips inside a
      // transaction with a 5s budget.
      if (rows.length > 0) await tx.food.createMany({ data: rows });
    }
  });

  revalidateDiary("/diary", "/add");
}

/** Which of the named meals this user actually owns. */
async function ownedMealIdSet(
  userId: string,
  ids: (number | null)[]
): Promise<Set<number>> {
  const wanted = Array.from(
    new Set(ids.filter((id): id is number => id != null))
  );
  if (wanted.length === 0) return new Set();
  const rows = await db.meal.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Save every AI-researched food in the dump to the shared library, keyed by
 * the item it came from. Concurrent — these are independent inserts.
 *
 * A food whose numbers the guards reject is skipped rather than failing the
 * dump: it still gets logged, just as an unlinked snapshot.
 */
async function saveAiFoods(
  userId: string,
  items: DescribedItem[]
): Promise<Map<DescribedItem, number>> {
  const aiItems = items.filter((i) => i.ai != null);
  const results = await Promise.allSettled(
    aiItems.map((item) =>
      saveAiFood(userId, {
        name: item.name,
        kcal: item.per100g.kcal,
        proteinG: item.per100g.proteinG,
        carbsG: item.per100g.carbsG,
        fatG: item.per100g.fatG,
        servingSizeG: item.ai!.servingSizeG,
        servingLabel: item.ai!.servingLabel,
        aiModel: item.ai!.aiModel,
        aiSources: item.ai!.aiSources,
      })
    )
  );

  const saved = new Map<DescribedItem, number>();
  results.forEach((result, i) => {
    if (result.status === "fulfilled") saved.set(aiItems[i], result.value);
    else console.error("[describe] couldn't save AI food", aiItems[i].name, result.reason);
  });
  return saved;
}
