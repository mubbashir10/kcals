import { ArrowLeft, Apple } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FoodsList } from "@/app/foods/foods-list";
import { type CustomFoodListItemData } from "@/components/custom-food-list-item";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FoodsPage() {
  const { userId } = await requireProfile();

  const foods = await db.customFood.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
  });

  const rows: CustomFoodListItemData[] = foods.map((c) => ({
    id: c.id,
    name: c.name,
    brand: c.brand,
    kcal: c.kcal,
    proteinG: c.proteinG,
    carbsG: c.carbsG,
    fatG: c.fatG,
    fiberG: c.fiberG,
    sugarG: c.sugarG,
    saturatedFatG: c.saturatedFatG,
    sodiumMg: c.sodiumMg,
    cholesterolMg: c.cholesterolMg,
    servingSizeG: c.servingSizeG,
    servingLabel: c.servingLabel,
    source: c.source,
  }));

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
          <span className="text-sm font-semibold tracking-tight">My foods</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {rows.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-16 text-center shadow-none">
            <Apple className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">No foods yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Foods you save as custom — or accept from an AI estimate when
              searching — show up here, ready to add to any meal.
            </p>
            <AppLink
              href="/add"
              className={cn(buttonVariants({ size: "lg" }), "mt-5 rounded-full")}
            >
              Search & add food
            </AppLink>
          </Card>
        ) : (
          <FoodsList foods={rows} />
        )}
      </main>
    </div>
  );
}
