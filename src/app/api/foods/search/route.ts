import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { searchOpenFoodFacts } from "@/lib/openfoodfacts";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import { requireUserId } from "@/lib/session";
import { searchFoods, type UsdaFood } from "@/lib/usda";

// Synthetic fdcId offset for Recipe rows in the search response. The
// client uses fdcId as a React key; a CustomFood is mapped to -id (small
// negatives), so we pick a deeper negative range to avoid collisions.
// The actual recipeId is carried in the separate `recipeId` field — the
// fdcId here is display-only and never sent back as a USDA reference.
const RECIPE_FDC_OFFSET = -1_000_000_000;

// Recipe rows are augmented with an explicit recipeId so the log path
// knows to set Food.recipeId rather than treating the synthetic fdcId
// as a USDA reference.
type RecipeResult = UsdaFood & { recipeId: number };

export async function GET(req: Request) {
  const userId = await requireUserId();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  try {
    // User recipes (private) + Custom foods (community) + USDA + Open
    // Food Facts in parallel. OFF fills the gap for regional packaged
    // brands (e.g. Dawn, Olper's) that USDA doesn't carry. The AI
    // fallback is its own endpoint (/api/foods/search/ai) so the client
    // can show a distinct "searching the web with AI…" indicator after
    // this returns empty.
    const [usdaFoods, customFoods, offFoods, recipes] = await Promise.all([
      searchFoods(q, { pageSize: 20 }),
      db.customFood.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      searchOpenFoodFacts(q, { pageSize: 15 }),
      db.recipe.findMany({
        where: { userId, name: { contains: q, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { ingredients: true },
      }),
    ]);

    // Map recipes to the same Food row shape used elsewhere. per-100g
    // is derived from ingredient snapshots + the recipe's effective
    // total weight (user-set, or sum of ingredient grams). Empty recipes
    // just show 0 — the UI handles that gracefully.
    const recipeAsResults: RecipeResult[] = recipes.map((r) => {
      const totals = computeRecipeTotals(r);
      return {
        fdcId: RECIPE_FDC_OFFSET - r.id,
        recipeId: r.id,
        name: r.name,
        brand: null,
        dataType: "Recipe",
        per100g: {
          kcal: totals.per100Kcal,
          proteinG: totals.per100ProteinG,
          carbsG: totals.per100CarbsG,
          fatG: totals.per100FatG,
        },
        // When servings is set, expose "1 serving = effectiveWeight / N"
        // so the existing dual-input portion dialog kicks in.
        servingSizeG: totals.servingG,
        servingLabel: totals.servingG != null ? "1 serving" : null,
        createdAtIso: r.createdAt.toISOString(),
      };
    });

    // Map custom foods into the same shape as a USDA result so the UI
    // renders them with a single rowtype. We use negative fdcId so they
    // never collide with real USDA ids. AI-sourced community rows
    // surface as "AI" so the sparkles badge persists for everyone, not
    // just the original approver.
    const customAsResults: UsdaFood[] = customFoods.map((c) => ({
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
      createdAtIso: c.createdAt.toISOString(),
    }));

    // Recipes first (the user's own stuff, most relevant), then
    // Community Custom, then USDA, then OFF.
    return NextResponse.json({
      foods: [...recipeAsResults, ...customAsResults, ...usdaFoods, ...offFoods],
    });
  } catch (err) {
    console.error("Food search failed", err);
    return NextResponse.json(
      { error: "Search failed", foods: [] },
      { status: 502 }
    );
  }
}
