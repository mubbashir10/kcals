// Client-side Health Connect access (Android, via capacitor-health) + the
// mapping into kcals' activity model. All calls no-op off-native.
//
// Key decision: we read the DE-DUPED daily aggregate, never raw records —
// multiple trackers (e.g. Mi Fitness + Fitbit) write overlapping step/calorie
// records, and Health Connect's aggregate resolves them by its source-priority
// list. Reading raw records would double-count.

import { isNative } from "@/lib/native";
import { upsertActivity } from "@/app/actions/activity";

const SYNC_KEY = "kcals.health-sync"; // localStorage flag: "on" when enabled

async function health() {
  const mod = await import("capacitor-health");
  return mod.Health;
}

// The plugin types the permission result as an array of maps, but at runtime
// it's a single map { READ_STEPS: true, ... }. Handle both.
function granted(perms: unknown): boolean {
  const ok = (o: Record<string, boolean> | undefined) =>
    Boolean(o?.READ_ACTIVE_CALORIES || o?.READ_STEPS);
  return Array.isArray(perms)
    ? perms.some((o) => ok(o))
    : ok(perms as Record<string, boolean>);
}

export async function healthAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await (await health()).isHealthAvailable()).available;
  } catch {
    return false;
  }
}

export async function requestHealthAccess(): Promise<boolean> {
  try {
    const res = await (await health()).requestHealthPermissions({
      permissions: ["READ_STEPS", "READ_ACTIVE_CALORIES"],
    });
    return granted(res.permissions);
  } catch {
    return false;
  }
}

export async function hasHealthAccess(): Promise<boolean> {
  try {
    const res = await (await health()).checkHealthPermissions({
      permissions: ["READ_STEPS", "READ_ACTIVE_CALORIES"],
    });
    return granted(res.permissions);
  } catch {
    return false;
  }
}

export type TodayActivity = { activeKcal: number | null; steps: number | null };

/** Today's de-duped totals (local-midnight → now). */
export async function readTodayActivity(): Promise<TodayActivity> {
  try {
    const Health = await health();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startDate = start.toISOString();
    const endDate = new Date().toISOString();
    const sum = async (dataType: "steps" | "active-calories") => {
      const agg = await Health.queryAggregated({
        startDate,
        endDate,
        dataType,
        bucket: "day",
      });
      const total = (agg.aggregatedData || []).reduce(
        (s, d) => s + (d.value || 0),
        0
      );
      return Math.round(total);
    };
    const [steps, activeKcal] = await Promise.all([
      sum("steps").catch(() => null),
      sum("active-calories").catch(() => null),
    ]);
    return { activeKcal, steps };
  } catch {
    return { activeKcal: null, steps: null };
  }
}

/**
 * Reads today's activity and writes it to today's ActivityLog. Prefers the
 * wearable's own active-calorie figure (override mode = the TDEE input); falls
 * back to steps (estimate mode) when only steps are available. Returns what was
 * read, or null if there was nothing to sync.
 */
export async function syncHealthNow(): Promise<TodayActivity | null> {
  const data = await readTodayActivity();
  if (data.activeKcal != null && data.activeKcal > 0) {
    await upsertActivity(null, {
      mode: "override",
      wearableKcal: data.activeKcal,
    });
  } else if (data.steps != null && data.steps > 0) {
    await upsertActivity(null, { mode: "estimate", steps: data.steps });
  } else {
    return null;
  }
  return data;
}

export function healthSyncEnabled(): boolean {
  try {
    return localStorage.getItem(SYNC_KEY) === "on";
  } catch {
    return false;
  }
}

export function setHealthSyncEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(SYNC_KEY, "on");
    else localStorage.removeItem(SYNC_KEY);
  } catch {
    // ignore
  }
}
