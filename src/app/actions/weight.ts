"use server";

import { db } from "@/lib/db";
import { getProfileTimezone } from "@/lib/clock.server";
import { instantWithinDayInTz, isFutureDayKey } from "@/lib/clock";
import { requireUserId } from "@/lib/session";
import { round1 } from "@/lib/utils";
import { revalidateDiary } from "@/lib/revalidate";
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from "@/lib/bmr";
import { syncProfileWeightToLatest } from "@/lib/weight";

function revalidateWeight() {
  revalidateDiary("/weight");
}

export async function logWeight(weightKg: number, dayKey?: string | null) {
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_MIN_KG || weightKg > WEIGHT_MAX_KG) {
    throw new Error("Invalid weight");
  }
  const userId = await requireUserId();
  const rounded = round1(weightKg);

  let loggedAt: Date | undefined;
  if (dayKey) {
    const tz = await getProfileTimezone(userId);
    if (isFutureDayKey(tz, dayKey)) throw new Error("Cannot log a future date");
    loggedAt = instantWithinDayInTz(tz, dayKey);
  }

  await db.weightLog.create({
    data: { userId, weightKg: rounded, loggedAt },
  });

  await syncProfileWeightToLatest(userId);

  revalidateWeight();
}

export async function deleteWeightLog(id: number) {
  const userId = await requireUserId();
  await db.weightLog.deleteMany({ where: { id, userId } });
  await syncProfileWeightToLatest(userId);
  revalidateWeight();
}

export async function updateWeightLog(id: number, weightKg: number) {
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_MIN_KG || weightKg > WEIGHT_MAX_KG) {
    throw new Error("Invalid weight");
  }
  const userId = await requireUserId();
  const rounded = round1(weightKg);

  await db.weightLog.updateMany({
    where: { id, userId },
    data: { weightKg: rounded },
  });

  await syncProfileWeightToLatest(userId);

  revalidateWeight();
}

export type WeightImportRow = {
  /** ISO date or datetime — parsed by `new Date(...)` */
  date: string;
  /** Already converted to kg before sending. */
  weightKg: number;
};

export type WeightImportResult = {
  imported: number;
  skipped: number;
};

export async function importWeightLogs(
  rows: WeightImportRow[]
): Promise<WeightImportResult> {
  const userId = await requireUserId();

  const valid = rows
    .map((r) => {
      const d = new Date(r.date);
      const kg = round1(r.weightKg);
      const okDate = !Number.isNaN(d.getTime());
      const okKg = Number.isFinite(kg) && kg >= WEIGHT_MIN_KG && kg <= WEIGHT_MAX_KG;
      return okDate && okKg
        ? { userId, weightKg: kg, loggedAt: d }
        : null;
    })
    .filter(
      (x): x is { userId: string; weightKg: number; loggedAt: Date } =>
        x !== null
    );

  if (valid.length > 0) {
    await db.weightLog.createMany({ data: valid });
    await syncProfileWeightToLatest(userId);
  }

  revalidateWeight();
  return { imported: valid.length, skipped: rows.length - valid.length };
}
