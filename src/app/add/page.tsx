import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { areFriends } from "@/lib/friends";
import { AddFoodClient, type MealOption } from "./add-food-client";
import type { SearchFood } from "@/lib/use-food-search";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import {
  autoMealNameInTz,
  dayKeyInTz,
  isHhmm,
  startOfDayForDayKey,
  startOfDayInTz,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

const MEAL_JOIN_WINDOW_MS = 2 * 60 * 60 * 1000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Mirrors the synthetic recipe id the search API emits (see
// /api/foods/search). Only used here as a stable React key — logging a
// recipe keys off `recipeId`, not this.
const RECIPE_FDC_OFFSET = -1_000_000_000;

// Build the preselected food for an "Add to meal" deep-link (?recipeId= or
// ?customFoodId=), so the portion sheet opens straight away. Returns null
// when the id is missing or doesn't resolve to one of the user's items.
async function loadPreselected(
  userId: string,
  recipeId: number | null,
  customFoodId: number | null
): Promise<SearchFood | null> {
  if (recipeId != null) {
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!recipe) return null;
    // Own recipe → link back via recipeId. A friend's recipe → allowed if
    // confirmed friends, but logged as a snapshot (ownerName, no recipeId).
    const isOwn = recipe.userId === userId;
    if (!isOwn && !(await areFriends(userId, recipe.userId))) return null;
    const ownerName = isOwn
      ? undefined
      : recipe.user.name ?? recipe.user.email.split("@")[0];
    const t = computeRecipeTotals(recipe);
    const servingG =
      t.servingG ?? (t.effectiveTotalWeightG > 0 ? t.effectiveTotalWeightG : null);
    return {
      fdcId: RECIPE_FDC_OFFSET - recipe.id,
      ...(isOwn ? { recipeId: recipe.id } : { ownerName }),
      name: recipe.name,
      brand: null,
      dataType: "Recipe",
      per100g: {
        kcal: t.per100Kcal,
        proteinG: t.per100ProteinG,
        carbsG: t.per100CarbsG,
        fatG: t.per100FatG,
      },
      servingSizeG: servingG,
      servingLabel: servingG != null ? "1 serving" : null,
    };
  }
  if (customFoodId != null) {
    const c = await db.customFood.findUnique({ where: { id: customFoodId } });
    if (!c) return null;
    return {
      fdcId: -c.id,
      name: c.name,
      brand: c.brand,
      dataType: c.source === "AI" ? "AI" : "Custom",
      per100g: {
        kcal: c.kcal,
        proteinG: c.proteinG ?? 0,
        carbsG: c.carbsG ?? 0,
        fatG: c.fatG ?? 0,
      },
      servingSizeG: c.servingSizeG,
      servingLabel: c.servingLabel,
    };
  }
  return null;
}

// UTC window [start, end) covering `dayKey`'s calendar day in `tz`.
function dayWindow(tz: string, dayKey: string): { start: Date; end: Date } {
  const start = startOfDayForDayKey(tz, dayKey);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{
    meal?: string;
    day?: string;
    recipeId?: string;
    customFoodId?: string;
    newMeal?: string;
    time?: string;
  }>;
}) {
  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const now = new Date();

  const sp = await searchParams;
  const requestedMealId = sp.meal ? parseInt(sp.meal, 10) : null;
  const recipeId = sp.recipeId ? parseInt(sp.recipeId, 10) : null;
  const customFoodId = sp.customFoodId ? parseInt(sp.customFoodId, 10) : null;
  const preselected = await loadPreselected(
    userId,
    Number.isFinite(recipeId) ? recipeId : null,
    Number.isFinite(customFoodId) ? customFoodId : null
  );

  // Default-meal placeholder deep-link: pre-target a new meal at its time.
  const initialNewMeal =
    sp.newMeal && sp.newMeal.trim() && sp.time && isHhmm(sp.time)
      ? { name: sp.newMeal.trim().slice(0, 60), time: sp.time }
      : null;

  // Which day are we adding to? A valid `?day=` that isn't today scopes the
  // whole flow to that past day; otherwise we're logging for today.
  const todayKey = dayKeyInTz(tz, now);
  const dayParam =
    sp.day && DAY_KEY_RE.test(sp.day) && sp.day !== todayKey ? sp.day : null;

  const window = dayParam
    ? dayWindow(tz, dayParam)
    : { start: startOfDayInTz(tz, now), end: null as Date | null };

  const meals = await db.meal.findMany({
    where: {
      userId,
      loggedAt: {
        gte: window.start,
        ...(window.end ? { lt: window.end } : {}),
      },
    },
    orderBy: { loggedAt: "desc" },
    include: { foods: { select: { kcal: true } } },
  });

  // Pick the default target:
  //   1. ?meal=<id> if it exists in the day's meals
  //   2. (today only) most recent meal within the join window
  //   3. otherwise null (creates a new meal)
  const requestedExists =
    requestedMealId != null && meals.some((m) => m.id === requestedMealId);
  const cutoff = new Date(now.getTime() - MEAL_JOIN_WINDOW_MS);
  const autoTargetId = requestedExists
    ? requestedMealId
    : dayParam
    ? null
    : meals.find((m) => new Date(m.loggedAt) >= cutoff)?.id ?? null;

  const mealOptions: MealOption[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    loggedAt: m.loggedAt.toISOString(),
    foodCount: m.foods.length,
    kcal: m.foods.reduce((a, f) => a + f.kcal, 0),
  }));

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />
      <AddFoodClient
        meals={mealOptions}
        autoTargetId={autoTargetId}
        suggestedNewMealName={autoMealNameInTz(now, tz)}
        timezone={tz}
        dayKey={dayParam}
        preselected={preselected}
        initialNewMeal={initialNewMeal}
      />
    </div>
  );
}
