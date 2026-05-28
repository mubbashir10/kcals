"use server";

import { db } from "@/lib/db";
import { dayKeyInTz, isFutureDayKey } from "@/lib/clock";
import { revalidateDiary } from "@/lib/revalidate";
import { requireUserId } from "@/lib/session";
import { buildDailySnapshot } from "@/lib/daily-snapshot";
import type { ActivityMode } from "@/lib/tdee";

export type ActivityLogInput = {
  mode: ActivityMode;
  steps?: number | null;
  liftingMin?: number | null;
  cardioMin?: number | null;
  wearableKcal?: number | null;
};

function sanitizeInt(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Math.round(value);
  if (v < min || v > max) return null;
  return v;
}

function revalidateActivity() {
  revalidateDiary();
}

// `dayKey === null` means "today" (computed server-side). Pass an explicit
// dayKey to edit a past day.
export async function upsertActivity(
  dayKey: string | null,
  input: ActivityLogInput
) {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;
  const tz = profile.timezone || "UTC";
  if (dayKey && isFutureDayKey(tz, dayKey)) {
    throw new Error("Cannot log a future date");
  }
  const key = dayKey ?? dayKeyInTz(tz);

  const mode: ActivityMode = input.mode === "override" ? "override" : "estimate";

  const overrideFields =
    mode === "override"
      ? {
          mode,
          steps: null,
          liftingMin: null,
          cardioMin: null,
          wearableKcal: sanitizeInt(input.wearableKcal, 0, 10000),
        }
      : {
          mode,
          steps: sanitizeInt(input.steps, 0, 200000),
          liftingMin: sanitizeInt(input.liftingMin, 0, 600),
          cardioMin: sanitizeInt(input.cardioMin, 0, 600),
          wearableKcal: null,
        };

  // Compute the TDEE snapshot from the override the user just provided.
  const snapshot = buildDailySnapshot(profile, {
    mode: overrideFields.mode,
    steps: overrideFields.steps,
    liftingMin: overrideFields.liftingMin,
    cardioMin: overrideFields.cardioMin,
    wearableKcal: overrideFields.wearableKcal,
  });

  await db.activityLog.upsert({
    where: { userId_dayKey: { userId, dayKey: key } },
    create: {
      userId,
      dayKey: key,
      ...overrideFields,
      bmrKcal: snapshot.bmrKcal,
      defaultActiveKcal: snapshot.defaultActiveKcal,
      overrideActiveKcal: snapshot.overrideActiveKcal,
      tdeeKcal: snapshot.tdeeKcal,
    },
    update: {
      ...overrideFields,
      bmrKcal: snapshot.bmrKcal,
      defaultActiveKcal: snapshot.defaultActiveKcal,
      overrideActiveKcal: snapshot.overrideActiveKcal,
      tdeeKcal: snapshot.tdeeKcal,
    },
  });

  revalidateActivity();
}

/**
 * "Clear" a day's log. We keep the row but null-out the override fields and
 * recompute TDEE from the default snapshot. The row persists so the daily
 * TDEE history stays complete. `dayKey === null` means "today".
 */
export async function clearActivity(dayKey: string | null) {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return;
  const tz = profile.timezone || "UTC";
  if (dayKey && isFutureDayKey(tz, dayKey)) {
    throw new Error("Cannot log a future date");
  }
  const key = dayKey ?? dayKeyInTz(tz);

  // Default snapshot only — no override.
  const snapshot = buildDailySnapshot(profile, null);

  await db.activityLog.upsert({
    where: { userId_dayKey: { userId, dayKey: key } },
    create: {
      userId,
      dayKey: key,
      mode: "estimate",
      steps: null,
      liftingMin: null,
      cardioMin: null,
      wearableKcal: null,
      bmrKcal: snapshot.bmrKcal,
      defaultActiveKcal: snapshot.defaultActiveKcal,
      overrideActiveKcal: null,
      tdeeKcal: snapshot.tdeeKcal,
    },
    update: {
      mode: "estimate",
      steps: null,
      liftingMin: null,
      cardioMin: null,
      wearableKcal: null,
      bmrKcal: snapshot.bmrKcal,
      defaultActiveKcal: snapshot.defaultActiveKcal,
      overrideActiveKcal: null,
      tdeeKcal: snapshot.tdeeKcal,
    },
  });

  revalidateActivity();
}
