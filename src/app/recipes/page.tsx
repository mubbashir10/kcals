import { ArrowLeft, ChefHat, Plus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RecipesList } from "@/app/recipes/recipes-list";
import { type RecipeListItemData } from "@/components/recipe-list-item";
import { createBlankRecipe } from "@/app/actions/recipes";
import { db } from "@/lib/db";
import { friendRecipesOf } from "@/lib/friends";
import { computeRecipeTotals } from "@/lib/recipe-totals";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RecipesPage() {
  const { userId } = await requireProfile();

  const [recipes, friendRecipes] = await Promise.all([
    db.recipe.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { ingredients: true },
    }),
    friendRecipesOf(userId),
  ]);

  // Pre-compute totals for the list view. Recipes whose totalWeightG is
  // null fall back to summing ingredient grams. `ownerName` tags a friend's
  // recipe (read-only).
  const toRow = (
    r: {
      id: number;
      name: string;
      totalWeightG: number | null;
      servings: number | null;
      ingredients: Parameters<typeof computeRecipeTotals>[0]["ingredients"];
    },
    ownerName?: string
  ): RecipeListItemData => {
    const totals = computeRecipeTotals(r);
    return {
      id: r.id,
      name: r.name,
      ingredientCount: r.ingredients.length,
      effectiveTotalWeightG: totals.effectiveTotalWeightG,
      weightIsDerived: totals.weightIsDerived,
      servings: r.servings,
      per100Kcal: totals.per100Kcal,
      ...(ownerName ? { ownerName } : {}),
    };
  };

  const rows = recipes.map((r) => toRow(r));
  const friendRows = friendRecipes.map((r) => toRow(r, r.ownerName));

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">Recipes</span>
          <form action={createBlankRecipe} className="ml-auto">
            <Button type="submit" className="rounded-full">
              <Plus className="h-3 w-3" />
              New recipe
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {rows.length === 0 && friendRows.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-16 text-center shadow-none">
            <ChefHat className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              No recipes yet.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Build one from individual foods — kheer, chicken tikka, your
              go-to breakfast bowl — and log a portion of it whenever you eat
              it.
            </p>
            <form action={createBlankRecipe} className="mt-5">
              <Button type="submit" size="lg" className="rounded-full">
                <Plus className="h-3.5 w-3.5" />
                New recipe
              </Button>
            </form>
          </Card>
        ) : (
          <RecipesList recipes={rows} friendRecipes={friendRows} />
        )}
      </main>
    </div>
  );
}
