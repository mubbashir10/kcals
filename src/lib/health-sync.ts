// Health Connect → ActivityLog. The Android shell reads a rolling window of
// per-day totals natively (see native/.../MainActivity.kt) and POSTs them to
// /api/health/sync, which lands here.
//
// Why a window and not just today: the shell can only read Health Connect while
// it's foregrounded, so a day's row froze at whatever partial total was on
// screen the last time the app had focus — everything walked after you last
// closed the app never made it in. Re-reading the last few days on every sync
// repairs those days once the band has finished uploading them.

import { db } from "@/lib/db";
import { activityLogFields } from "@/lib/activity-log";
import { shiftDayKey } from "@/lib/calendar-build";
import { dayKeyInTz, isDayKey } from "@/lib/clock";
import { revalidateDiary } from "@/lib/revalidate";

export type HealthDay = {
  /** `null` means "today", resolved here in the user's timezone. */
  dayKey: string | null;
  steps: number | null;
  activeKcal: number | null;
  /** App Health Connect credits the day to, e.g. "Mi Fitness". */
  source?: string | null;
};

// Long enough for "Zepp Life, Mi Fitness"; anything past that is a broken
// client, not a label. Shared with the measurement import, which caps the
// same Health Connect app labels.
export const MAX_SOURCE_LEN = 80;

// Rolling window the native shell reads and we accept, today inclusive. Health
// Connect's default read grant only reaches 30 days back, and a band has
// normally finished uploading a day within a couple of them — a week is slack.
export const HEALTH_SYNC_DAYS = 7;

export type HealthSyncResult = {
  /** False when the user has switched the integration off. */
  enabled: boolean;
  /** Day keys whose ActivityLog we wrote. */
  synced: string[];
  /** Day keys we refused: hand-entered, out of window, or nothing to record. */
  skipped: string[];
};

/** Cheap standalone read for the shell's pre-flight check. */
export async function healthSyncEnabled(userId: string): Promise<boolean> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { healthSync: true },
  });
  return profile?.healthSync ?? false;
}

/**
 * Write a batch of Health-Connect day totals. A day is written when Health
 * Connect actually has something for it and the day isn't hand-entered;
 * everything else is skipped rather than zeroed, so a phone left at home never
 * erases a day.
 */
export async function syncHealthDays(
  userId: string,
  days: HealthDay[]
): Promise<HealthSyncResult> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const refused = (enabled: boolean): HealthSyncResult => ({
    enabled,
    synced: [],
    skipped: days.map((d) => d.dayKey ?? "today"),
  });
  if (!profile) return refused(false);
  // The shell checks this before reading Health Connect; re-check here so a
  // stale shell that skipped the check still can't write.
  if (!profile.healthSync) return refused(false);

  const tz = profile.timezone || "UTC";
  const todayKey = dayKeyInTz(tz);
  // The phone's clock and the profile timezone can disagree by a day at the
  // boundary, so bound the window here rather than trusting what was posted.
  const oldestKey = shiftDayKey(todayKey, -(HEALTH_SYNC_DAYS - 1));

  // Last entry wins if the shell ever repeats a day.
  const byDay = new Map<string, HealthDay>();
  const skipped = new Set<string>();
  for (const day of days) {
    const dayKey = day.dayKey ?? todayKey;
    const usable =
      isDayKey(dayKey) &&
      dayKey <= todayKey &&
      dayKey >= oldestKey &&
      ((day.activeKcal ?? 0) > 0 || (day.steps ?? 0) > 0);
    if (usable) byDay.set(dayKey, day);
    else skipped.add(dayKey);
  }
  if (byDay.size === 0) {
    return { enabled: true, synced: [], skipped: [...skipped] };
  }

  const existing = await db.activityLog.findMany({
    where: { userId, dayKey: { in: [...byDay.keys()] } },
    select: { dayKey: true, manual: true },
  });
  for (const row of existing) {
    if (row.manual && byDay.delete(row.dayKey)) skipped.add(row.dayKey);
  }
  if (byDay.size === 0) {
    return { enabled: true, synced: [], skipped: [...skipped] };
  }

  await db.$transaction(
    [...byDay].map(([dayKey, day]) => {
      // A band reporting no active energy at all isn't saying the day was
      // motionless — it's saying it has nothing to offer. Leave the field empty
      // so the steps it *did* report drive the estimate instead of a zero
      // total overriding them.
      const fields = activityLogFields(profile, {
        steps: day.steps,
        activeKcal: (day.activeKcal ?? 0) > 0 ? day.activeKcal : null,
      });
      const source = day.source?.trim().slice(0, MAX_SOURCE_LEN) || null;
      return db.activityLog.upsert({
        where: { userId_dayKey: { userId, dayKey } },
        create: { userId, dayKey, manual: false, source, ...fields },
        update: { manual: false, source, ...fields },
      });
    })
  );
  revalidateDiary();

  return { enabled: true, synced: [...byDay.keys()], skipped: [...skipped] };
}
