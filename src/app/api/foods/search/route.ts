import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { friendRecipesOf } from "@/lib/friends";
import { searchLocalFoods } from "@/lib/local-foods";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import { requireUserId } from "@/lib/session";
import { searchFoods, type UsdaFood } from "@/lib/usda";
import { round1 } from "@/lib/utils";

// Synthetic fdcId offset for Recipe rows in the search response. The
// client uses fdcId as a React key; a CustomFood is mapped to -id (small
// negatives), so we pick a deeper negative range to avoid collisions.
// The actual recipeId is carried in the separate `recipeId` field — the
// fdcId here is display-only and never sent back as a USDA reference.
const RECIPE_FDC_OFFSET = -1_000_000_000;

// Synthetic fdcId floor for "Recently logged" rows (the user's own diary
// history). Sits below int4's minimum so persistableFdcId() nulls it on
// any write — these are logged as plain snapshots, never as a reference
// back to the diary row they were derived from. Kept clear of the local
// Reference floor (-3e9) to avoid React-key collisions.
const RECENT_FDC_FLOOR = -4_000_000_000;

// How many distinct recently-logged foods to surface. Small — this is a
// "pick what you usually eat" shortcut, not a second search results list.
const RECENT_TAKE = 8;

// Recipe rows are augmented with an explicit recipeId so the log path
// knows to set Food.recipeId rather than treating the synthetic fdcId
// as a USDA reference. A friend's recipe instead carries `ownerName` and
// no recipeId — it's logged as a snapshot, not linked back to their row.
type RecipeResult = UsdaFood & { recipeId?: number; ownerName?: string };

export async function GET(req: Request) {
  const userId = await requireUserId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  // Split the query on whitespace and AND-match each token against the
  // name. A plain `contains: q` was too rigid for local rows — "haleem
  // oat" would never match a recipe named "Oat Haleem" (USDA/OFF tolerate
  // word order because they're real search engines; Postgres `contains`
  // is just a substring match). All tokens must appear, in any order.
  const tokens = q.split(/\s+/).filter((t) => t.length > 0);
  const nameTokensAnd = tokens.map((t) => ({
    name: { contains: t, mode: "insensitive" as const },
  }));

  try {
    // Curated local rows (whole foods + South Asian dishes) — synchronous,
    // zero-latency, brand-free. Surfaced ahead of USDA so a search for
    // "apple" or "biryani" lands a clean reference hit instead of a wall
    // of branded products.
    const localFoods = searchLocalFoods(q);

    // The user's own diary history + recipes + Custom foods (community) +
    // USDA + Open Food Facts in parallel. Recent diary rows lead the
    // result ladder so re-logging a food you already eat is the first,
    // zero-friction hit. OFF fills the gap for regional packaged brands
    // (e.g. Dawn, Olper's) that USDA doesn't carry. The AI fallback is its
    // own endpoint (/api/foods/search/ai) so the client can show a
    // distinct "searching the web with AI…" indicator after this returns
    // empty.
    const [recentLogged, usdaFoods, customFoods, offFoods, recipes, friendRecipes] =
      await Promise.all([
        // Foods this user has logged before. Exclude recipe-logged rows
        // (recipeId set — they resurface in the recipe group) and quick
        // calorie-only adds (grams 0 — no per-gram profile to rescale).
        // Ordered newest-first; deduped by name below so each food shows
        // once with its most-recent portion as the default serving.
        db.food.findMany({
          where: {
            meal: { userId },
            recipeId: null,
            grams: { gt: 0 },
            AND: nameTokensAnd,
          },
          orderBy: { loggedAt: "desc" },
          take: 80,
          select: {
            id: true,
            name: true,
            brand: true,
            grams: true,
            kcal: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            loggedAt: true,
          },
        }),
        searchFoods(q, { pageSize: 20 }),
        db.customFood.findMany({
          where: { AND: nameTokensAnd },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        searchOpenFoodFacts(q, { pageSize: 15 }),
        db.recipe.findMany({
          where: { userId, AND: nameTokensAnd },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { ingredients: true },
        }),
        friendRecipesOf(userId, { nameTokensAnd, take: 20 }),
      ]);

    // Collapse the diary history to one row per food (by name, case-
    // insensitive), keeping the most-recent occurrence. Nutrients were
    // stored already scaled to the logged portion, so divide back out to
    // per-100g; the logged grams becomes the suggested serving so the
    // portion dialog opens pre-filled to what the user usually eats.
    const recentResults: UsdaFood[] = [];
    const seenRecent = new Set<string>();
    for (const f of recentLogged) {
      const key = f.name.trim().toLowerCase();
      if (seenRecent.has(key)) continue;
      seenRecent.add(key);
      const per = (n: number) => round1((n / f.grams) * 100);
      recentResults.push({
        fdcId: RECENT_FDC_FLOOR - f.id,
        name: f.name,
        brand: f.brand,
        dataType: "Recent",
        per100g: {
          kcal: per(f.kcal),
          proteinG: per(f.proteinG),
          carbsG: per(f.carbsG),
          fatG: per(f.fatG),
        },
        servingSizeG: round1(f.grams),
        servingLabel: null,
        createdAtIso: f.loggedAt.toISOString(),
      });
      if (recentResults.length >= RECENT_TAKE) break;
    }

    // Map a recipe (own or a friend's) to the shared Food row shape.
    // per-100g is derived from ingredient snapshots + the recipe's
    // effective total weight. `ownerName` set → it's a friend's recipe:
    // read-only, logged as a snapshot (no recipeId link-back).
    const toRecipeResult = (
      r: {
        id: number;
        name: string;
        totalWeightG: number | null;
        servings: number | null;
        createdAt: Date;
        ingredients: Parameters<typeof computeRecipeTotals>[0]["ingredients"];
      },
      ownerName?: string
    ): RecipeResult => {
      const totals = computeRecipeTotals(r);
      // Default a recipe with no explicit `servings` to "1 serving = whole
      // recipe" so logging it from /add lands one diary row of the full
      // composed weight, instead of falling back to a 100g portion.
      const defaultServingG =
        totals.servingG ??
        (totals.effectiveTotalWeightG > 0 ? totals.effectiveTotalWeightG : null);
      return {
        fdcId: RECIPE_FDC_OFFSET - r.id,
        ...(ownerName ? { ownerName } : { recipeId: r.id }),
        name: r.name,
        brand: null,
        dataType: "Recipe",
        per100g: {
          kcal: totals.per100Kcal,
          proteinG: totals.per100ProteinG,
          carbsG: totals.per100CarbsG,
          fatG: totals.per100FatG,
        },
        servingSizeG: defaultServingG,
        servingLabel: defaultServingG != null ? "1 serving" : null,
        createdAtIso: r.createdAt.toISOString(),
      };
    };

    const recipeAsResults: RecipeResult[] = recipes.map((r) => toRecipeResult(r));
    const friendRecipeResults: RecipeResult[] = friendRecipes.map((r) =>
      toRecipeResult(r, r.ownerName)
    );

    // Map custom foods into the same shape as a USDA result so the UI
    // renders them with a single rowtype. We use negative fdcId so they
    // never collide with real USDA ids, and split by provenance:
    //   • "MyFood"  — a USER food this person saved themselves; ranked up
    //     near their own stuff (their "saved foods").
    //   • "Custom"  — a USER food someone else contributed (community).
    //   • "AI"      — any AI-generated row, regardless of who approved it,
    //     so the sparkles badge persists for everyone and these stay the
    //     last-resort tier.
    const myFoodResults: UsdaFood[] = [];
    const communityCustomResults: UsdaFood[] = [];
    const aiCustomResults: UsdaFood[] = [];
    for (const c of customFoods) {
      const mapped: UsdaFood = {
        fdcId: -c.id,
        name: c.name,
        brand: c.brand,
        dataType: "Custom",
        per100g: {
          kcal: c.kcal,
          proteinG: c.proteinG ?? 0,
          carbsG: c.carbsG ?? 0,
          fatG: c.fatG ?? 0,
        },
        servingSizeG: c.servingSizeG,
        servingLabel: c.servingLabel,
        createdAtIso: c.createdAt.toISOString(),
      };
      if (c.source === "AI") {
        aiCustomResults.push({ ...mapped, dataType: "AI" });
      } else if (c.createdById === userId) {
        myFoodResults.push({ ...mapped, dataType: "MyFood" });
      } else {
        communityCustomResults.push(mapped);
      }
    }

    // Order = relevance ladder the UI groups on, "closest to the user"
    // first: foods they've logged before → foods they saved → their
    // recipes → friends' recipes → the shared databases (local reference
    // leads, then community customs, then branded USDA/OFF) → AI rows
    // last. The client re-groups by dataType, but this order also sets the
    // within-group sequence (e.g. local reference rows lead whole foods).
    return NextResponse.json({
      foods: [
        ...recentResults,
        ...myFoodResults,
        ...recipeAsResults,
        ...friendRecipeResults,
        ...localFoods,
        ...communityCustomResults,
        ...usdaFoods,
        ...offFoods,
        ...aiCustomResults,
      ],
    });
  } catch (err) {
    console.error("Food search failed", err);
    return NextResponse.json(
      { error: "Search failed", foods: [] },
      { status: 502 }
    );
  }
}
