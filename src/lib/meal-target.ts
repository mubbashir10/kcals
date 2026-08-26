// "Which meal on this day is called X?" — one definition, because the answer
// is what makes default-meal placeholders work.
//
// A placeholder is not a row: it's a template with no meal behind it yet.
// So the rule is name-based — the meal on this day whose name matches,
// case-insensitively, or a new one at the template's time. That is exactly
// the rule placeholderMealsForDay uses to decide a placeholder is spent, so
// the two can't disagree and a double-submit can't produce two Breakfasts.

import type { Prisma } from "@/generated/prisma/client";
import { instantOnDayInTz, startOfDayForDayKey } from "@/lib/clock";

/** The subset of the client both `db` and a `$transaction` handle satisfy. */
type MealClient = Pick<Prisma.TransactionClient, "meal">;

/**
 * Find the meal named `name` on `dayKey`, creating it at `timeHhmm` if it
 * isn't there yet. Idempotent by name — call it twice and you get the same
 * meal back.
 */
export async function resolveMealOnDay(
  client: MealClient,
  opts: {
    userId: string;
    tz: string;
    dayKey: string;
    name: string;
    timeHhmm: string;
  }
): Promise<{ id: number; created: boolean }> {
  const name = opts.name.trim();
  const dayStart = startOfDayForDayKey(opts.tz, opts.dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const existing = await client.meal.findFirst({
    where: {
      userId: opts.userId,
      loggedAt: { gte: dayStart, lt: dayEnd },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const meal = await client.meal.create({
    data: {
      userId: opts.userId,
      name,
      loggedAt: instantOnDayInTz(opts.tz, opts.dayKey, opts.timeHhmm),
    },
    select: { id: true },
  });
  return { id: meal.id, created: true };
}
