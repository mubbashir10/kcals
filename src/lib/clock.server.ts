import { db } from "@/lib/db";

const FALLBACK_TZ = "UTC";

export async function getProfileTimezone(): Promise<string> {
  const p = await db.profile.findFirst({ select: { timezone: true } });
  return p?.timezone || FALLBACK_TZ;
}
