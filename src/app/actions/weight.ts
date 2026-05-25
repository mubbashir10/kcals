"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

export async function logWeight(weightKg: number) {
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
    throw new Error("Invalid weight");
  }
  const userId = await requireUserId();
  const rounded = Math.round(weightKg * 10) / 10;

  await db.weightLog.create({ data: { userId, weightKg: rounded } });

  // Keep the profile weight in sync with the latest log so BMR/TDEE
  // stay accurate.
  await db.profile.updateMany({
    where: { userId },
    data: { weightKg: rounded },
  });

  revalidatePath("/");
}

export async function deleteWeightLog(id: number) {
  const userId = await requireUserId();
  await db.weightLog.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function updateWeightLog(id: number, weightKg: number) {
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
    throw new Error("Invalid weight");
  }
  const userId = await requireUserId();
  const rounded = Math.round(weightKg * 10) / 10;

  await db.weightLog.updateMany({
    where: { id, userId },
    data: { weightKg: rounded },
  });

  // If the edited entry is now the most recent, sync the profile weight.
  const latest = await db.weightLog.findFirst({
    where: { userId },
    orderBy: { loggedAt: "desc" },
  });
  if (latest) {
    await db.profile.updateMany({
      where: { userId },
      data: { weightKg: latest.weightKg },
    });
  }

  revalidatePath("/");
  revalidatePath("/weight");
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
      const kg = Math.round(r.weightKg * 10) / 10;
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

    // Sync profile weight to whatever the newest log is now.
    const latest = await db.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: "desc" },
    });
    if (latest) {
      await db.profile.updateMany({
        where: { userId },
        data: { weightKg: latest.weightKg },
      });
    }
  }

  revalidatePath("/");
  return { imported: valid.length, skipped: rows.length - valid.length };
}
