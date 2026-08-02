import { db } from "@/lib/db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The cutoff a 7-day weight comparison looks back to. */
export function weekAgoFrom(now: Date): Date {
  return new Date(now.getTime() - WEEK_MS);
}

/**
 * Change between the newest weigh-in and the newest one at least a week old.
 * Null when either end is missing, so "no baseline yet" reads as "no trend"
 * rather than as zero change.
 */
export function weightDelta7dKg(
  latest: { weightKg: number } | null,
  baseline: { weightKg: number } | null
): number | null {
  if (!latest || !baseline) return null;
  return latest.weightKg - baseline.weightKg;
}

// Keep the profile weight in sync with the most recent weigh-in so BMR/TDEE
// stay accurate. Called after any weight mutation, since past-day edits,
// deletes, and imports can change which log is newest.
export async function syncProfileWeightToLatest(userId: string) {
  const latest = await db.weightLog.findFirst({
    where: { userId },
    orderBy: { loggedAt: "desc" },
    select: { weightKg: true },
  });
  if (latest) {
    await db.profile.updateMany({
      where: { userId },
      data: { weightKg: latest.weightKg },
    });
  }
}
