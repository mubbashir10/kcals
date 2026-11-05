import { Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AppLink } from "@/components/app-link";
import { MealTitle } from "@/components/meal-card-parts";
import { Card } from "@/components/ui/card";

// A default meal that has no real meal yet today. Visually a MealCard in its
// "No food yet" state, but with no totals or menu — it isn't a row in the DB.
// "Add food" deep-links to /add pre-targeting a new meal at this time, which
// is what actually creates the meal.
export function PlaceholderMealCard({
  name,
  timeLabel,
  timeHhmm,
}: {
  name: string;
  timeLabel: string;
  timeHhmm: string;
}) {
  const addHref = `/add?newMeal=${encodeURIComponent(name)}&time=${encodeURIComponent(timeHhmm)}`;

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl bg-card/40 p-0 shadow-none">
      <header className="flex items-baseline gap-2 px-5 pt-4">
        <MealTitle name={name} time={timeLabel} className="text-foreground/80" />
      </header>

      <div className="px-5 pb-5 pt-3 text-center">
        <p className="mb-3 text-xs text-muted-foreground">No food yet</p>
        <AppLink
          href={addHref}
          className={cn(buttonVariants(), "rounded-full")}
        >
          <Plus className="h-3 w-3" />
          Add food
        </AppLink>
      </div>
    </Card>
  );
}
