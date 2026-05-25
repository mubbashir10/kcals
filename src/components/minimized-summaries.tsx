import { UtensilsCrossed, Users } from "lucide-react";

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
  return (
    <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <UtensilsCrossed className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Meals
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/80 tabular-nums">
            {mealCount === 0
              ? "nothing yet"
              : `${mealCount} ${mealCount === 1 ? "meal" : "meals"} · ${foodCount} ${foodCount === 1 ? "food" : "foods"} · ${kcal.toLocaleString()} kcal`}
          </span>
          <WidgetMenu
            widgetId="meals"
            current="minimized"
            label="Meals"
            size="sm"
          />
        </div>
      </div>
    </Card>
  );
}

export function MinimizedFriendsSummary({ count }: { count: number }) {
  return (
    <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Friends
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/80 tabular-nums">
            {count === 0
              ? "none yet"
              : `${count} ${count === 1 ? "friend" : "friends"}`}
          </span>
          <WidgetMenu
            widgetId="friends"
            current="minimized"
            label="Friends"
            size="sm"
          />
        </div>
      </div>
    </Card>
  );
}
