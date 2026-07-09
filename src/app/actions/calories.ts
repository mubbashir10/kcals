"use server";

import { db } from "@/lib/db";
import {
  dayKeyInTz,
  instantOnDayInTz,
  isFutureDayKey,
  startOfDayForDayKey,
} from "@/lib/clock";
import { shiftDayKey } from "@/lib/calendar-build";
import {
  FOOD_MEAL_DAY_SELECT,
  foodDayKey,
  foodsOfMealsInRange,
} from "@/lib/food-day";
import { getProfileTimezone } from "@/lib/clock.server";
import { requireUserId } from "@/lib/session";
import { round1 } from "@/lib/utils";
import { revalidateDiary } from "@/lib/revalidate";
import type { CaloriesCsvRow } from "@/lib/calories-csv";

// NOTE: this file is "use server" — it may only export async functions, so the
// types below are intentionally NOT exported (the client derives them via
// `Awaited<ReturnType<...>>` and passes `CaloriesCsvRow[]`). Exporting a type
// from a "use server" module triggers a runtime 500.

type ClassifiedDay = {
  dayKey: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type Classification = {
  // Days clear to import: valid, not in the future, no existing food.
  toCreate: ClassifiedDay[];
  // Days skipped because they already have logged food — never overwritten.
  existingDays: string[];
  // Rows dropped: bad date, non-positive kcal, future date, or a second row
  // for a day already claimed earlier in the same file.
  invalid: number;
};

// Shared by preview and import so the numbers the user confirms are the numbers
// that get written. Import re-runs this (not the cached preview) so a day that
// gained food between preview and confirm is still protected.
async function classify(
  userId: string,
  tz: string,
  rows: CaloriesCsvRow[]
): Promise<Classification> {
  const byDay = new Map<string, ClassifiedDay>();
  let invalid = 0;

  for (const r of rows) {
    const d = new Date(r.date);
    const kcal = round1(r.kcal);
    if (Number.isNaN(d.getTime()) || !Number.isFinite(kcal) || kcal <= 0) {
      invalid++;
      continue;
    }
    const dayKey = dayKeyInTz(tz, d);
    if (isFutureDayKey(tz, dayKey) || byDay.has(dayKey)) {
      invalid++; // future day, or a duplicate row for a day already taken
      continue;
    }
    byDay.set(dayKey, {
      dayKey,
      kcal,
      proteinG: Math.max(0, round1(r.proteinG)),
      carbsG: Math.max(0, round1(r.carbsG)),
      fatG: Math.max(0, round1(r.fatG)),
    });
  }

  const candidates = [...byDay.values()];
  if (candidates.length === 0) return { toCreate: [], existingDays: [], invalid };

  // Which candidate days already have food? One range query over the span,
  // then bucket the hits by day. A day with any Food is off-limits. The end of
  // the range is the *start of the day after* the last candidate — shifting the
  // day key (not adding 24h) so a DST-long day doesn't clip its final hour.
  const dayKeys = candidates.map((c) => c.dayKey).sort();
  const rangeStart = startOfDayForDayKey(tz, dayKeys[0]);
  const rangeEnd = startOfDayForDayKey(
    tz,
    shiftDayKey(dayKeys[dayKeys.length - 1], 1)
  );
  const existing = await db.food.findMany({
    where: foodsOfMealsInRange(userId, rangeStart, rangeEnd),
    select: FOOD_MEAL_DAY_SELECT,
  });
  const daysWithFood = new Set(existing.map((f) => foodDayKey(tz, f)));

  const toCreate: ClassifiedDay[] = [];
  const existingDays: string[] = [];
  for (const c of candidates) {
    if (daysWithFood.has(c.dayKey)) existingDays.push(c.dayKey);
    else toCreate.push(c);
  }
  return { toCreate, existingDays, invalid };
}

// Dry-run for the dialog: classify without writing, so the user sees the three
// buckets (importable / already-have-entries / invalid) before confirming.
export async function previewCalorieImport(rows: CaloriesCsvRow[]) {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  const { toCreate, existingDays, invalid } = await classify(userId, tz, rows);
  return {
    importable: toCreate.length,
    existing: existingDays.length,
    invalid,
    // A short sample of protected days, for the "skipped" hint in the dialog.
    existingDays: existingDays.sort().slice(0, 8),
  };
}

// Each importable day becomes one "Imported" meal holding a single quick-add
// (grams: 0 — kcal-only, no portion math), pinned to noon local so it buckets
// onto the right calendar day. Days with existing food are skipped, never
// merged, so totals stay trustworthy.
export async function importCalorieDays(rows: CaloriesCsvRow[]) {
  const userId = await requireUserId();
  const tz = await getProfileTimezone(userId);
  const { toCreate, existingDays, invalid } = await classify(userId, tz, rows);

  if (toCreate.length > 0) {
    const days = toCreate.map((day) => ({
      ...day,
      loggedAt: instantOnDayInTz(tz, day.dayKey, "12:00"),
    }));

    // Bulk insert via createMany, not a per-day meal.create fan-out: a year of
    // days is ~365 round-trips, which blows past the 5s default transaction
    // timeout (P2028). createMany collapses each table to one statement. Foods
    // are linked by matching meals back on their loggedAt — safe because every
    // "Imported" meal is created here *with* a food, so a noon-local "Imported"
    // meal can only exist on a day that has food, and such days are skipped.
    await db.$transaction(
      async (tx) => {
        await tx.meal.createMany({
          data: days.map((d) => ({ userId, name: "Imported", loggedAt: d.loggedAt })),
        });
        const meals = await tx.meal.findMany({
          where: {
            userId,
            name: "Imported",
            loggedAt: { in: days.map((d) => d.loggedAt) },
          },
          select: { id: true, loggedAt: true },
        });
        const mealIdByTime = new Map(meals.map((m) => [m.loggedAt.getTime(), m.id]));
        await tx.food.createMany({
          data: days.map((d) => ({
            mealId: mealIdByTime.get(d.loggedAt.getTime())!,
            fdcId: null,
            name: "Imported",
            grams: 0,
            kcal: d.kcal,
            proteinG: d.proteinG,
            carbsG: d.carbsG,
            fatG: d.fatG,
            loggedAt: d.loggedAt,
          })),
        });
      },
      { timeout: 30000 }
    );
    revalidateDiary("/calories", "/diary");
  }

  return {
    imported: toCreate.length,
    skipped: existingDays.length + invalid,
  };
}
