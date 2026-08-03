// A number the app is forecasting rather than reporting — today's burn, before
// today is over. One soft-tinted pill wherever such a number appears (the day
// equation, the activity card), so "this part is an estimate" reads the same
// everywhere instead of being re-invented per surface.
//
// The tilde does the work on its own; the tint is there to catch the eye at a
// glance on a line that is otherwise all muted text.

import type { BurnProjection } from "@/lib/daily-snapshot";
import { cn } from "@/lib/utils";

export const projectedPill =
  "rounded-full bg-primary/10 px-1.5 py-0.5 ring-1 ring-inset ring-primary/20";

/** Whole kcal, grouped — the one format every projected figure prints in. */
const kcal = (n: number) => Math.round(n).toLocaleString();

export function ProjectedValue({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        projectedPill,
        "font-semibold tabular-nums text-foreground",
        className
      )}
    >
      ~{kcal(value)}
    </span>
  );
}

/**
 * The projection in words — what's on the clock, and how much of a typical day
 * is still expected. Shared by the equation's tooltip and the activity card so
 * the two can't drift into telling different stories.
 *
 * `lactationKcal` is named when the term being explained folds milk in too;
 * without it the parts wouldn't sum to the number they're annotating.
 */
export function projectionSentence(
  { soFarKcal, restOfDayKcal }: BurnProjection,
  lactationKcal = 0
): string {
  const milk =
    lactationKcal > 0 ? `, and ${kcal(lactationKcal)} for milk` : "";
  return `${kcal(soFarKcal)} burned so far, plus a typical ${kcal(
    restOfDayKcal
  )} still to come${milk}`;
}

/** The same thing for a hint slot that truncates: "170 so far + 336 typical". */
export function projectionHint({
  soFarKcal,
  restOfDayKcal,
}: BurnProjection): string {
  return `${kcal(soFarKcal)} so far + ${kcal(restOfDayKcal)} typical`;
}
