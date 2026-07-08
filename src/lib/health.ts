// Client-side Health Connect access (Android, via capacitor-health) + the
// mapping into kcals' activity model. All calls no-op off-native.
//
// Key decision: we read the DE-DUPED daily aggregate, never raw records —
// multiple trackers (e.g. Mi Fitness + Fitbit) write overlapping step/calorie
// records, and Health Connect's aggregate resolves them by its source-priority
// list. Reading raw records would double-count.

import { isNative, nativePlatform } from "@/lib/native";
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

type HealthApi = Awaited<ReturnType<typeof health>>;

/** Device-local midnight → now, as ISO strings. */
function todayWindow(): { startDate: string; endDate: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: new Date().toISOString() };
}

/** De-duped daily total for a data type (HC resolves overlapping sources by
 *  its priority list; we sum the single day bucket). */
async function aggregateTotal(
  Health: HealthApi,
  startDate: string,
  endDate: string,
  dataType: "steps" | "active-calories"
): Promise<number> {
  const agg = await Health.queryAggregated({ startDate, endDate, dataType, bucket: "day" });
  return Math.round(
    (agg.aggregatedData || []).reduce((s, d) => s + (d.value || 0), 0)
  );
}

/** Today's de-duped totals (local-midnight → now). */
export async function readTodayActivity(): Promise<TodayActivity> {
  try {
    const Health = await health();
    const { startDate, endDate } = todayWindow();
    const [steps, activeKcal] = await Promise.all([
      aggregateTotal(Health, startDate, endDate, "steps").catch(() => null),
      aggregateTotal(Health, startDate, endDate, "active-calories").catch(() => null),
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

// ─── On-device diagnostics ──────────────────────────────────────────────
// Health Connect is a headless data store, so this surfaces exactly what the
// plugin hands kcals: the de-duped daily aggregate we actually use, plus the
// raw per-source step records (each with its writer + time range). Comparing
// "latest step data" against wall-clock reveals how stale a tracker like Mi
// Fitness's writes are; multiple sources flag potential double-counting.

export type HealthRecordRow = {
  source: string;
  start: string;
  end: string;
  value: number;
  manual: boolean;
};

export type HealthDebug = {
  native: boolean;
  platform: string;
  capacitorGlobal: string;
  swActive: boolean;
  ua: string;
  appVersion: string;
  available: boolean;
  permission: boolean;
  tz: string;
  windowStart: string;
  readAt: string;
  aggSteps: number | null;
  aggActiveKcal: number | null;
  records: HealthRecordRow[];
  recordCount: number;
  sources: string[];
  latestRecordEnd: string | null;
  error: string | null;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Installed native app version+build (e.g. "1.1 (2)"). Comes from @capacitor/app,
// which is present in every build — so it reveals whether an old APK (missing
// the capacitor-health plugin) is installed vs the current one.
async function appVersion(): Promise<string> {
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return "unknown";
  }
}

export async function readHealthDebug(): Promise<HealthDebug> {
  const { startDate, endDate } = todayWindow();
  const dbg: HealthDebug = {
    native: isNative(),
    platform: nativePlatform(),
    capacitorGlobal: "?",
    swActive: false,
    ua: "",
    appVersion: "unknown",
    available: false,
    permission: false,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    windowStart: startDate,
    readAt: endDate,
    aggSteps: null,
    aggActiveKcal: null,
    records: [],
    recordCount: 0,
    sources: [],
    latestRecordEnd: null,
    error: null,
  };

  // Pure-JS environment probes — no native bridge calls, so they never hang
  // even when the bridge is missing. `window.Capacitor` is the object the
  // native shell injects; if it's absent, the bridge never loaded.
  if (typeof window !== "undefined") {
    const cap = (
      window as unknown as {
        Capacitor?: {
          getPlatform?: () => string;
          isNativePlatform?: () => boolean;
        };
      }
    ).Capacitor;
    dbg.capacitorGlobal = cap
      ? `present · platform=${cap.getPlatform?.() ?? "?"} · isNative=${cap.isNativePlatform?.() ?? "?"}`
      : "MISSING — bridge not injected";
  }
  if (typeof navigator !== "undefined") {
    dbg.swActive = Boolean(navigator.serviceWorker?.controller);
    dbg.ua = navigator.userAgent;
  }

  if (!dbg.native) {
    dbg.error =
      "isNative() = false — Capacitor bridge not detected (see 'Capacitor global').";
    return dbg; // don't call plugins — they'd hang with no bridge to answer.
  }
  try {
    // App version comes from @capacitor/app; safe now that the bridge exists.
    dbg.appVersion = await appVersion();
    const Health = await health();
    // Five independent read-only bridge hops over the same window — run them
    // concurrently. Each keeps its own catch so one failure doesn't blank the
    // rest; the queryRecords guard in particular lets an older plugin without
    // it still return the aggregates.
    const [available, permission, aggSteps, aggActiveKcal, records] =
      await Promise.all([
        Health.isHealthAvailable()
          .then((r) => r.available)
          .catch(() => false),
        hasHealthAccess().catch(() => false),
        aggregateTotal(Health, startDate, endDate, "steps").catch(() => null),
        aggregateTotal(Health, startDate, endDate, "active-calories").catch(() => null),
        Health.queryRecords({ startDate, endDate, dataType: "steps" })
          .then((r) => r.records || [])
          .catch((e) => {
            dbg.error = `records: ${errMsg(e)}`;
            return [];
          }),
      ]);
    dbg.available = available;
    dbg.permission = permission;
    dbg.aggSteps = aggSteps;
    dbg.aggActiveKcal = aggActiveKcal;

    const rows: HealthRecordRow[] = records.map((r) => ({
      source: r.sourceName,
      start: r.startDate,
      end: r.endDate,
      value: Math.round(r.value || 0),
      manual: r.manual,
    }));
    rows.sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0));
    dbg.records = rows;
    dbg.recordCount = rows.length;
    dbg.sources = [...new Set(rows.map((r) => r.source))];
    dbg.latestRecordEnd = rows[0]?.end ?? null;
  } catch (e) {
    dbg.error = errMsg(e);
  }
  return dbg;
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
