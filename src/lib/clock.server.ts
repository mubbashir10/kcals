import { db } from "@/lib/db";

const FALLBACK_TZ = "UTC";

/** Get the timezone for a user's profile (UTC if no profile exists yet). */
export async function getProfileTimezone(userId: string): Promise<string> {
  const p = await db.profile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return p?.timezone || FALLBACK_TZ;
}
