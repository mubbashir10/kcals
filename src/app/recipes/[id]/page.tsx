import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { RecipeBuilder } from "@/components/recipe-builder";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RecipeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (!Number.isFinite(id)) notFound();

  const userId = await requireUserId();
  const recipe = await db.recipe.findFirst({
    where: { id, userId },
    include: { ingredients: { orderBy: { position: "asc" } } },
  });
  if (!recipe) notFound();

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/recipes"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">Recipe</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <RecipeBuilder
          recipe={{
            id: recipe.id,
            name: recipe.name,
            totalWeightG: recipe.totalWeightG,
            servings: recipe.servings,
            ingredients: recipe.ingredients.map((i) => ({
              id: i.id,
              fdcId: i.fdcId,
              name: i.name,
              brand: i.brand,
              per100Kcal: i.per100Kcal,
              per100ProteinG: i.per100ProteinG,
              per100CarbsG: i.per100CarbsG,
              per100FatG: i.per100FatG,
              grams: i.grams,
            })),
          }}
        />
      </main>
    </div>
  );
}
