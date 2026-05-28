"use server";

import { db } from "@/lib/db";
import { getProfileTimezone } from "@/lib/clock.server";
import { instantWithinDayInTz, isFutureDayKey } from "@/lib/clock";
import { requireUserId } from "@/lib/session";
import { round1 } from "@/lib/utils";
import { revalidateDiary } from "@/lib/revalidate";

// Keep the profile weight in sync with the most recent weigh-in so BMR/TDEE
// stay accurate. Called after any weight mutation, since past-day edits and
// deletes can change which log is newest.
async function syncProfileWeightToLatest(userId: string) {
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

function revalidateWeight() {
  revalidateDiary("/weight");
}

export async function logWeight(weightKg: number, dayKey?: string | null) {
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
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
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
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
      const okKg = Number.isFinite(kg) && kg >= 30 && kg <= 300;
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
