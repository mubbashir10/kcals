// Pure helper for turning a user's default-meal templates into the
// placeholder cards shown on the current day. A default is "satisfied" when
// a real meal that day already shares its name (case-insensitive), so logging
// — which auto-names a meal "Breakfast" etc. — makes the placeholder give way
// to the real card. Placeholders only ever show on today; past days stay as
// they were logged.

import { instantOnDayInTz } from "@/lib/clock";
import { db } from "@/lib/db";

export type PlaceholderMeal = {
  name: string;
  timeHhmm: string;
  /** Synthetic instant (the template's time on this day) for interleaving
   *  with real meals when sorting by time. */
  loggedAt: Date;
};

export function placeholderMealsForDay(opts: {
  defaults: { name: string; timeHhmm: string }[];
  realMealNames: (string | null)[];
  dayKey: string;
  todayKey: string;
  tz: string;
}): PlaceholderMeal[] {
  // Scaffolding is a "today and forward" concept — never backfill past days.
  if (opts.dayKey !== opts.todayKey) return [];

  const taken = new Set(
    opts.realMealNames
      .filter((n): n is string => !!n)
      .map((n) => n.trim().toLowerCase())
  );

  return opts.defaults
    .filter((d) => !taken.has(d.name.trim().toLowerCase()))
    .map((d) => ({
      name: d.name,
      timeHhmm: d.timeHhmm,
      loggedAt: instantOnDayInTz(opts.tz, opts.dayKey, d.timeHhmm),
    }));
}

export type DayMealItem<M> =
  | { kind: "real"; meal: M; loggedAt: Date }
  | { kind: "placeholder"; placeholder: PlaceholderMeal; loggedAt: Date };

// Interleave real meals and placeholders by time, honoring the user's meal
// sort direction — so a placeholder lands in its natural slot among logged
// meals rather than always at the top or bottom.
export function mergeDayMeals<M extends { loggedAt: Date | string }>(
  meals: M[],
  placeholders: PlaceholderMeal[],
  sortDir: "asc" | "desc"
): DayMealItem<M>[] {
  const items: DayMealItem<M>[] = [
    ...meals.map((m) => ({
      kind: "real" as const,
      meal: m,
      loggedAt: new Date(m.loggedAt),
    })),
    ...placeholders.map((p) => ({
      kind: "placeholder" as const,
      placeholder: p,
      loggedAt: p.loggedAt,
    })),
  ];
  items.sort((a, b) =>
    sortDir === "asc"
      ? a.loggedAt.getTime() - b.loggedAt.getTime()
      : b.loggedAt.getTime() - a.loggedAt.getTime()
  );
  return items;
}

// One-stop for a day's rendered meals: fetch the user's defaults (only when
// the day is today and `enabled`), turn the unmatched ones into placeholders,
// and merge with the real meals. `enabled` lets a caller skip the query when
// the meals section is hidden. The today-only rule lives entirely in
// placeholderMealsForDay, so callers don't restate it.
export async function loadDayMealItems<
  M extends { loggedAt: Date | string; name: string | null },
>(opts: {
  userId: string;
  meals: M[];
  dayKey: string;
  todayKey: string;
  tz: string;
  sortDir: "asc" | "desc";
  enabled?: boolean;
}): Promise<DayMealItem<M>[]> {
  const wantDefaults = opts.enabled !== false && opts.dayKey === opts.todayKey;
  const defaults = wantDefaults
    ? await db.defaultMeal.findMany({
        where: { userId: opts.userId },
        orderBy: { position: "asc" },
        select: { name: true, timeHhmm: true },
      })
    : [];
  const placeholders = placeholderMealsForDay({
    defaults,
    realMealNames: opts.meals.map((m) => m.name),
    dayKey: opts.dayKey,
    todayKey: opts.todayKey,
    tz: opts.tz,
  });
  return mergeDayMeals(opts.meals, placeholders, opts.sortDir);
}
