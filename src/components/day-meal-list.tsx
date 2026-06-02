import { MealCard, type MealCardData } from "@/components/meal-card";
import { PlaceholderMealCard } from "@/components/placeholder-meal-card";
import { formatTimeInTz } from "@/lib/clock";
import type { DayMealItem } from "@/lib/default-meals";

// Renders a day's meals — real cards and default-meal placeholders — already
// merged and time-sorted by loadDayMealItems. Shared by the home and day
// pages so the two stay identical.
export function DayMealList<M extends MealCardData>({
  items,
  timezone,
}: {
  items: DayMealItem<M>[];
  timezone: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.kind === "real" ? (
          <MealCard key={`m-${item.meal.id}`} meal={item.meal} timezone={timezone} />
        ) : (
          <PlaceholderMealCard
            key={`p-${item.placeholder.name}-${item.placeholder.timeHhmm}`}
            name={item.placeholder.name}
            timeHhmm={item.placeholder.timeHhmm}
            timeLabel={formatTimeInTz(item.placeholder.loggedAt, timezone)}
          />
        )
      )}
    </div>
  );
}
