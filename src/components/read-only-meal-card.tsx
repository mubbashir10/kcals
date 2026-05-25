// Stripped-down meal card used on the friend-view page — no edit/delete
// buttons, no dropdowns. Server component since it has no interactivity.

import { Card } from "@/components/ui/card";
import { formatTimeInTz } from "@/lib/clock";

export type ReadOnlyMeal = {
  id: number;
  name: string | null;
  loggedAt: Date | string;
  foods: {
    id: number;
    name: string;
    brand: string | null;
    grams: number;
    kcal: number;
  }[];
};

export function ReadOnlyMealCard({
  meal,
  timezone,
}: {
  meal: ReadOnlyMeal;
  timezone: string;
}) {
  const mealKcal = meal.foods.reduce((a, f) => a + f.kcal, 0);
  const time = formatTimeInTz(meal.loggedAt, timezone);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/30 px-5 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h3 className="truncate text-sm font-semibold tracking-tight">
            {meal.name ?? "Meal"}
          </h3>
          <time className="text-xs text-muted-foreground tabular-nums">
            {time}
          </time>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">
            {Math.round(mealKcal)}
          </span>{" "}
          kcal
        </div>
      </header>

      {meal.foods.length === 0 ? (
        <div className="px-5 py-6 text-center text-xs text-muted-foreground">
          No food in this meal.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {meal.foods.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{f.name}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {f.brand ? `${f.brand} · ` : ""}
                  {round1(f.grams)} g
                </div>
              </div>
              <div className="min-w-[44px] text-right">
                <div className="text-base font-semibold tabular-nums">
                  {Math.round(f.kcal)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  kcal
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
