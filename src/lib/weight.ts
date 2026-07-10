import { db } from "@/lib/db";

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
