import { UtensilsCrossed, Users } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";

export function MinimizedMealsSummary({
  mealCount,
  foodCount,
  kcal,
}: {
  mealCount: number;
  foodCount: number;
  kcal: number;
}) {
  const metric =
    mealCount === 0
      ? "nothing yet"
      : `${mealCount} ${mealCount === 1 ? "meal" : "meals"} · ${foodCount} ${
          foodCount === 1 ? "food" : "foods"
        } · ${kcal.toLocaleString()} kcal`;

  return (
    <Card className="group relative rounded-2xl border-border/60 px-5 py-3 shadow-card transition-colors hover:bg-accent/20">
      <AppLink
        href="/diary"
        aria-label="View food diary"
        className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Meals
          </span>
        </div>
        <WidgetMenu
          widgetId="meals"
          current="minimized"
          label="Meals"
          size="sm"
        />
      </div>
      <div className="relative mt-1 truncate text-sm text-foreground/80 tabular-nums">
        {metric}
      </div>
    </Card>
  );
}

export function MinimizedFriendsSummary({ count }: { count: number }) {
  const metric =
    count === 0 ? "none yet" : `${count} ${count === 1 ? "friend" : "friends"}`;

  return (
    <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Friends
          </span>
        </div>
        <WidgetMenu
          widgetId="friends"
          current="minimized"
          label="Friends"
          size="sm"
        />
      </div>
      <div className="mt-1 truncate text-sm text-foreground/80 tabular-nums">
        {metric}
      </div>
    </Card>
  );
}
