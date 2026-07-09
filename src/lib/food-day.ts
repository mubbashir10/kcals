// Which calendar day does a Food belong to?
//
// The day of its MEAL — never its own `loggedAt`. `Food.loggedAt` is stamped
// when the row is written, so a snack typed in after midnight, or any food
// backfilled onto a past day, carries a timestamp from a different day than the
// meal it sits in. Bucketing by it silently shifts calories between days: the
// day page (which reads foods through their meal) and the week/calendar/history
// pages disagreed for exactly this reason.
//
// Query foods through the meal relation and read the day off `food.meal`.

import { dayKeyInTz } from "@/lib/clock";

/** `where` clause selecting one user's foods whose MEAL falls in [start, end). */
export function foodsOfMealsInRange(
  userId: string,
  start: Date,
  end?: Date
) {
  return {
    meal: { userId, loggedAt: end ? { gte: start, lt: end } : { gte: start } },
  };
}

/** Pair with the `where` above so `foodDayKey` has something to read. */
export const FOOD_MEAL_DAY_SELECT = {
  meal: { select: { loggedAt: true } },
} as const;

export function foodDayKey(
  tz: string,
  food: { meal: { loggedAt: Date } }
): string {
  return dayKeyInTz(tz, food.meal.loggedAt);
}
