// What every kind of meal card shares, so an editable meal, a friend's meal and
// an empty placeholder keep reading as the same object.

import { MacroFigures } from "@/components/macro-figures";
import type { MacroGrams } from "@/lib/nutrition";
import { cn, round1 } from "@/lib/utils";

export function MealTitle({
  name,
  time,
  className,
}: {
  name: string;
  time: string;
  className?: string;
}) {
  return (
    <>
      <h3
        className={cn(
          "truncate font-heading text-lg font-semibold tracking-tight",
          className
        )}
      >
        {name}
      </h3>
      <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {time}
      </time>
    </>
  );
}

// A food's name, and beneath it how much there was and what it gave.
export function FoodSummary({
  food: f,
}: {
  food: MacroGrams & { name: string; brand: string | null; grams: number };
}) {
  const serving = [f.brand, f.grams > 0 ? `${round1(f.grams)} g` : null]
    .filter(Boolean)
    .join(", ");
  // A food logged with calories only stores 0/0/0 — that means "not entered",
  // so don't print it as if it were a measurement.
  const hasMacros = f.proteinG + f.carbsG + f.fatG > 0;

  return (
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm leading-tight">{f.name}</div>
      {(serving || hasMacros) && (
        <div className="mt-1 flex items-baseline gap-2.5 text-[11px] text-muted-foreground">
          {serving && <span className="min-w-0 truncate">{serving}</span>}
          {hasMacros && (
            <MacroFigures
              proteinG={f.proteinG}
              carbsG={f.carbsG}
              fatG={f.fatG}
              className="shrink-0"
            />
          )}
        </div>
      )}
    </div>
  );
}

export function KcalColumn({
  kcal,
  strong = false,
}: {
  kcal: number;
  /** The meal's total, as opposed to one food's. */
  strong?: boolean;
}) {
  return (
    <div className="shrink-0 text-right tabular-nums">
      <span
        className={
          strong ? "font-heading text-xl font-semibold" : "text-sm font-semibold"
        }
      >
        {Math.round(kcal)}
      </span>
      <span className="ml-1 text-[11px] text-muted-foreground">kcal</span>
    </div>
  );
}
