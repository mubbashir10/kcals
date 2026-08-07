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
  /** Minutes of logged exercise, already bucketed by the shell. */
  liftingMin?: number | null;
  cardioMin?: number | null;
  /** App Health Connect credits the day to, e.g. "Mi Fitness". */
  source?: string | null;
};

/** An app that has contributed, with the icon Android shows for it. */
export type HealthSourceIcon = { name: string; icon: string };

// Long enough for "Zepp Life, Mi Fitness"; anything past that is a broken
// client, not a label. Shared with the measurement import, which caps the
// same Health Connect app labels.
export const MAX_SOURCE_LEN = 80;

// Rolling window the native shell reads and we accept, today inclusive. Health
// Connect's default read grant only reaches 30 days back, and a band has
// normally finished uploading a day within a couple of them — a week is slack.
export const HEALTH_SYNC_DAYS = 7;

// A 96px launcher icon lands around 10 KB as a PNG data URI. The cap is room
// to spare, not a target: past it we're being handed something that isn't an
// icon, and it would ride the dashboard payload on every render.
export const MAX_ICON_LEN = 64_000;
const ICON_PREFIX = "data:image/png;base64,";
// One phone shows a handful of fitness apps at most. More than this is a
// broken client, not a user with opinions.
const MAX_SOURCES = 12;

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
 * Apps we already hold an icon for. The shell reads this before syncing and
 * only sends icons for names missing from it — an icon is a few kilobytes and
 * a sync fires on every app focus, so re-posting the same one all day is pure
 * waste.
 */
export async function healthSourceNames(userId: string): Promise<string[]> {
  const rows = await db.healthSource.findMany({
    where: { userId },
    select: { name: true },
  });
  return rows.map((r) => r.name);
}

/**
 * Store the launcher icons the shell resolved. Anything that isn't a plainly
 * shaped PNG data URI is dropped rather than stored: this lands in an <img>
 * on the dashboard, and the only writer that should ever reach it is our own
 * shell.
 */
export async function saveHealthSources(
  userId: string,
  sources: HealthSourceIcon[]
): Promise<number> {
  const clean = sources
    .map((s) => ({
      name: s.name.trim().slice(0, MAX_SOURCE_LEN),
      icon: s.icon.trim(),
    }))
    .filter(
      (s) =>
        s.name.length > 0 &&
        s.icon.startsWith(ICON_PREFIX) &&
        s.icon.length > ICON_PREFIX.length &&
        s.icon.length <= MAX_ICON_LEN
    )
    .slice(0, MAX_SOURCES);
  if (clean.length === 0) return 0;

  await db.$transaction(
    clean.map((s) =>
      db.healthSource.upsert({
        where: { userId_name: { userId, name: s.name } },
        create: { userId, name: s.name, icon: s.icon },
        update: { icon: s.icon },
      })
    )
  );
  return clean.length;
}

/**
 * The icon to show beside a day's `source`. Null for a hand-entered day, an
 * app we've never been sent an icon for, or a day crediting two apps at once
 * (whose stored label is their joined names and matches neither).
 */
export async function healthSourceIcon(
  userId: string,
  name: string | null | undefined
): Promise<string | null> {
  if (!name) return null;
  const row = await db.healthSource.findUnique({
    where: { userId_name: { userId, name } },
    select: { icon: true },
  });
  return row?.icon ?? null;
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
      const total = (day.activeKcal ?? 0) > 0 ? day.activeKcal : null;
      const fields = activityLogFields(profile, {
        steps: day.steps,
        activeKcal: total,
        // Workout minutes are kept only alongside a total, and dropped without
        // one. Health Connect holds a 30-minute run twice — as a session and
        // as the steps it took — so on the estimate path the minutes and the
        // steps would each bill for the same run. With a total, the total wins
        // outright and the minutes are simply what the day shows.
        liftingMin: total != null ? day.liftingMin : null,
        cardioMin: total != null ? day.cardioMin : null,
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
