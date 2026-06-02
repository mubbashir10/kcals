import { Plus } from "lucide-react";

import { AppLink } from "@/components/app-link";
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
    <Card className="overflow-hidden rounded-2xl border-dashed border-border/60 bg-card/40 p-0 shadow-none">
      <header className="border-b border-border/60 bg-muted/20 px-5 py-3">
        <h3 className="truncate text-sm font-semibold tracking-tight text-foreground/80">
          {name}
        </h3>
        <time className="mt-0.5 block text-[11px] text-muted-foreground tabular-nums">
          {timeLabel}
        </time>
      </header>

      <div className="px-5 py-6 text-center">
        <p className="mb-3 text-xs text-muted-foreground">No food yet</p>
        <AppLink
          href={addHref}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-foreground px-4 text-xs font-medium text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          Add food
        </AppLink>
      </div>
    </Card>
  );
}
