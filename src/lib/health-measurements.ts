// Two-way body-measurement sync with Health Connect (weight, height, body
// fat). The Android shell (see native/.../MainActivity.kt) drives it on every
// foreground:
//
//   1. GET /api/health/measurements → the full desired Health Connect state,
//      built here. The shell upserts every record (stable clientRecordId +
//      version, so re-writes are idempotent and edits overwrite) and deletes
//      its own records that fell off the list. Sending everything every time
//      IS the backfill — the first sync exports the whole history, and a
//      wiped Health Connect self-heals on the next one.
//   2. The shell then reads what OTHER apps wrote (a smart scale's weigh-ins,
//      a height someone set in Mi Fitness) and POSTs them here, where
//      importMeasurements() applies them.
//
// Health Connect has no record type for age/sex, so the profile fields it can
// carry are exactly these three.

import { db } from "@/lib/db";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from "@/lib/bmr";
import { MAX_SOURCE_LEN } from "@/lib/health-sync";
import { round1 } from "@/lib/utils";
import { revalidateDiary } from "@/lib/revalidate";

// Stable Health Connect clientRecordIds. Weight is per-log; height and body
// fat are singletons — each upsert replaces the previous record.
export const HC_WEIGHT_ID_PREFIX = "kcals-weight-";
export const HC_HEIGHT_ID = "kcals-height";
export const HC_BODY_FAT_ID = "kcals-bodyfat";

// Health Connect record UUIDs are 36 chars; anything much longer is garbage.
const MAX_HC_ID_LEN = 128;
// Reject measurement timestamps from before the app could exist or from the
// future (allowing a day of clock skew).
const OLDEST_EPOCH_MS = Date.UTC(2000, 0, 1);

type HcRecord = { id: string; epochMs: number; version: number };

/** Everything kcals wants to exist in Health Connect, in one payload. */
export type MeasurementState = {
  /** False when the user has switched the integration off. */
  enabled: boolean;
  weights: (HcRecord & { kg: number })[];
  height: (HcRecord & { cm: number }) | null;
  bodyFat: (HcRecord & { pct: number }) | null;
};

const DISABLED_STATE: MeasurementState = {
  enabled: false,
  weights: [],
  height: null,
  bodyFat: null,
};

export async function measurementState(
  userId: string
): Promise<MeasurementState> {
  // The disabled case wastes the logs query, but the shell pre-checks the
  // toggle, so enabled is the overwhelmingly common path — fetch in parallel.
  const [profile, logs] = await Promise.all([
    db.profile.findUnique({
      where: { userId },
      select: {
        healthSync: true,
        updatedAt: true,
        heightCm: true,
        hcHeightCm: true,
        bodyFatPct: true,
        hcBodyFatPct: true,
      },
    }),
    // Only weigh-ins born in kcals — rows imported from Health Connect stay
    // out so the originating app's record is never echoed back as ours.
    // Future timestamps (a CSV import can carry one) are excluded too: Health
    // Connect rejects them, and one bad record would sink its insert batch.
    db.weightLog.findMany({
      where: { userId, hcId: null, loggedAt: { lte: new Date() } },
      select: { id: true, weightKg: true, loggedAt: true, updatedAt: true },
      orderBy: { loggedAt: "asc" },
    }),
  ]);
  if (!profile?.healthSync) return DISABLED_STATE;

  // Height/body fat have no per-record history, so the version rides on the
  // profile row. It only ever moves forward, which is all Health Connect
  // needs to tell an edit from a replay.
  const profileVersion = profile.updatedAt.getTime();
  // Exact float compares are safe ONLY because every writer of these fields
  // funnels through round1 — keep it that way.
  const heightOwned = profile.heightCm !== profile.hcHeightCm;
  const bodyFatOwned =
    profile.bodyFatPct != null && profile.bodyFatPct !== profile.hcBodyFatPct;

  return {
    enabled: true,
    weights: logs.map((log) => ({
      id: `${HC_WEIGHT_ID_PREFIX}${log.id}`,
      kg: log.weightKg,
      epochMs: log.loggedAt.getTime(),
      version: log.updatedAt.getTime(),
    })),
    height: heightOwned
      ? {
          id: HC_HEIGHT_ID,
          cm: profile.heightCm,
          epochMs: profileVersion,
          version: profileVersion,
        }
      : null,
    bodyFat: bodyFatOwned
      ? {
          id: HC_BODY_FAT_ID,
          pct: profile.bodyFatPct!,
          epochMs: profileVersion,
          version: profileVersion,
        }
      : null,
  };
}

export type WeightImport = {
  /** Health Connect record UUID. */
  hcId: string;
  kg: number;
  epochMs: number;
  /** App the record came from, e.g. "Mi Fitness". */
  source: string | null;
};

export type MeasurementImport = {
  weights: WeightImport[];
  height: { hcId: string; cm: number; epochMs: number } | null;
  bodyFat: { hcId: string; pct: number; epochMs: number } | null;
};

export type MeasurementImportResult = {
  enabled: boolean;
  /** Weigh-ins actually created (new + valid). */
  imported: number;
  heightApplied: boolean;
  bodyFatApplied: boolean;
};

const usableId = (id: string) => id.length > 0 && id.length <= MAX_HC_ID_LEN;

/**
 * Apply what other apps wrote to Health Connect. Weigh-ins are one-shot by
 * record id — the ledger remembers every id ever posted, so re-syncs and
 * deleted imports never duplicate or resurrect a row. Height and body fat are
 * one-shot the same way: a NEW external record overwrites the profile, but a
 * user edit afterwards sticks until the next new record appears.
 */
export async function importMeasurements(
  userId: string,
  data: MeasurementImport
): Promise<MeasurementImportResult> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { healthSync: true, hcHeightId: true, hcBodyFatId: true },
  });
  const result: MeasurementImportResult = {
    enabled: Boolean(profile?.healthSync),
    imported: 0,
    heightApplied: false,
    bodyFatApplied: false,
  };
  if (!profile?.healthSync) return result;

  const newestEpochMs = Date.now() + 24 * 60 * 60 * 1000;
  const usableEpoch = (ms: number) =>
    ms >= OLDEST_EPOCH_MS && ms <= newestEpochMs;

  // Everything the profile row needs is folded into ONE update at the end.
  const patch: {
    weightKg?: number;
    heightCm?: number;
    hcHeightId?: string;
    hcHeightCm?: number;
    bodyFatPct?: number;
    hcBodyFatId?: string;
    hcBodyFatPct?: number;
  } = {};

  // ── Weigh-ins ─────────────────────────────────────────────────────────
  // Last entry wins if the shell repeats an id within one batch.
  const byId = new Map<string, WeightImport>();
  for (const w of data.weights) {
    if (usableId(w.hcId)) byId.set(w.hcId, w);
  }
  if (byId.size > 0) {
    const seen = await db.healthConnectImport.findMany({
      where: { userId, hcId: { in: [...byId.keys()] } },
      select: { hcId: true },
    });
    for (const row of seen) byId.delete(row.hcId);
  }
  if (byId.size > 0) {
    const fresh = [...byId.values()];
    // Out-of-range records still land in the ledger — they'd never become
    // valid, so remembering them stops the shell re-posting them forever.
    const rows = fresh
      .filter(
        (w) =>
          w.kg >= WEIGHT_MIN_KG &&
          w.kg <= WEIGHT_MAX_KG &&
          usableEpoch(w.epochMs)
      )
      .map((w) => ({
        userId,
        weightKg: round1(w.kg),
        loggedAt: new Date(w.epochMs),
        hcId: w.hcId,
        source: w.source?.trim().slice(0, MAX_SOURCE_LEN) || null,
      }));
    const [created] = await db.$transaction([
      db.weightLog.createMany({ data: rows, skipDuplicates: true }),
      db.healthConnectImport.createMany({
        data: fresh.map((w) => ({ userId, hcId: w.hcId })),
        skipDuplicates: true,
      }),
    ]);
    // Count what was actually created — a concurrent double-POST loses the
    // race in skipDuplicates and must not be announced as imported.
    result.imported = created.count;
    if (created.count > 0) {
      // Same job as syncProfileWeightToLatest, but folded into the single
      // profile update below so BMR/TDEE track the newest weigh-in.
      const latest = await db.weightLog.findFirst({
        where: { userId },
        orderBy: { loggedAt: "desc" },
        select: { weightKg: true },
      });
      if (latest) patch.weightKg = latest.weightKg;
    }
  }

  // ── Height / body fat ─────────────────────────────────────────────────
  // A record id we haven't applied yet wins over the profile; the round1'd
  // value is remembered on both sides so it never bounces back out (see
  // measurementState's ownership gate).
  const applyExternal = (
    entry: { hcId: string; epochMs: number } | null,
    value: number | undefined,
    prevId: string | null,
    min: number,
    max: number
  ): number | null => {
    if (!entry || value == null) return null;
    const ok =
      usableId(entry.hcId) &&
      entry.hcId !== prevId &&
      value >= min &&
      value <= max &&
      usableEpoch(entry.epochMs);
    return ok ? round1(value) : null;
  };

  const cm = applyExternal(
    data.height,
    data.height?.cm,
    profile.hcHeightId,
    HEIGHT_MIN_CM,
    HEIGHT_MAX_CM
  );
  if (cm != null) {
    patch.heightCm = cm;
    patch.hcHeightId = data.height!.hcId;
    patch.hcHeightCm = cm;
    result.heightApplied = true;
  }
  const pct = applyExternal(
    data.bodyFat,
    data.bodyFat?.pct,
    profile.hcBodyFatId,
    BODY_FAT_MIN_PCT,
    BODY_FAT_MAX_PCT
  );
  if (pct != null) {
    patch.bodyFatPct = pct;
    patch.hcBodyFatId = data.bodyFat!.hcId;
    patch.hcBodyFatPct = pct;
    result.bodyFatApplied = true;
  }

  if (Object.keys(patch).length > 0) {
    await db.profile.update({ where: { userId }, data: patch });
  }
  if (result.imported > 0 || result.heightApplied || result.bodyFatApplied) {
    revalidateDiary("/weight");
  }
  return result;
}
