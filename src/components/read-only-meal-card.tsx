// Stripped-down meal card used on the friend-view page — no edit/delete
// buttons, no dropdowns. Server component since it has no interactivity.

import { MacroFigures, MacroStripe } from "@/components/macro-figures";
import {
  FoodSummary,
  KcalColumn,
  MealTitle,
} from "@/components/meal-card-parts";
import { Card } from "@/components/ui/card";
import { formatTimeInTz } from "@/lib/clock";
import { sumNutrients, type Nutrients } from "@/lib/nutrition";

export type ReadOnlyMeal = {
  id: number;
  name: string | null;
  loggedAt: Date | string;
  foods: (Nutrients & {
    id: number;
    name: string;
    brand: string | null;
    grams: number;
  })[];
};

export function ReadOnlyMealCard({
  meal,
  timezone,
}: {
  meal: ReadOnlyMeal;
  timezone: string;
}) {
  const totals = sumNutrients(meal.foods);

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl border-border/60 p-0 shadow-none">
      <header className="px-5 pb-1.5 pt-4">
        <div className="flex items-baseline gap-2">
          <MealTitle
            name={meal.name ?? "Meal"}
            time={formatTimeInTz(meal.loggedAt, timezone)}
          />
        </div>
        <div className="mt-1 flex items-baseline gap-3">
          <MacroFigures
            strong
            {...totals}
            className="min-w-0 flex-1 flex-wrap gap-y-0.5 text-xs text-muted-foreground"
          />
          <KcalColumn kcal={totals.kcal} strong />
        </div>
        <MacroStripe {...totals} className="mt-3" />
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
              <FoodSummary food={f} />
              <KcalColumn kcal={f.kcal} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
