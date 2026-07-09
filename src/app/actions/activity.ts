"use server";

import { db } from "@/lib/db";
import { activityLogFields, type ActivityLogInput } from "@/lib/activity-log";
import { dayKeyInTz, isFutureDayKey } from "@/lib/clock";
import { revalidateDiary } from "@/lib/revalidate";
import { requireUserId } from "@/lib/session";
import { buildDailySnapshot } from "@/lib/daily-snapshot";

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

  // `manual` fences the day off from the Health Connect backfill, which
  // otherwise rewrites the last week on every app launch.
  const fields = { ...activityLogFields(profile, input), manual: true };

  await db.activityLog.upsert({
    where: { userId_dayKey: { userId, dayKey: key } },
    create: { userId, dayKey: key, ...fields },
    update: fields,
  });

  revalidateActivity();
}

/**
 * "Clear" a day's log. We keep the row but null-out the override fields and
 * recompute TDEE from the default snapshot. The row persists so the daily
 * TDEE history stays complete. `dayKey === null` means "today". Clearing also
 * drops the `manual` fence, handing the day back to the Health Connect sync.
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

  const cleared = {
    mode: "estimate",
    steps: null,
    liftingMin: null,
    cardioMin: null,
    wearableKcal: null,
    manual: false,
    bmrKcal: snapshot.bmrKcal,
    defaultActiveKcal: snapshot.defaultActiveKcal,
    overrideActiveKcal: null,
    tdeeKcal: snapshot.tdeeKcal,
  };

  await db.activityLog.upsert({
    where: { userId_dayKey: { userId, dayKey: key } },
    create: { userId, dayKey: key, ...cleared },
    update: cleared,
  });

  revalidateActivity();
}
