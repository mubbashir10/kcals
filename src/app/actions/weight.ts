"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";

export async function logWeight(weightKg: number) {
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 300) {
    throw new Error("Invalid weight");
  }
  const rounded = Math.round(weightKg * 10) / 10;

  await db.weightLog.create({ data: { weightKg: rounded } });

  // Keep the profile weight in sync with the latest log so BMR/TDEE
  // stay accurate.
  const profile = await db.profile.findFirst();
  if (profile) {
    await db.profile.update({
      where: { id: profile.id },
      data: { weightKg: rounded },
    });
  }

  revalidatePath("/");
}

export async function deleteWeightLog(id: number) {
  await db.weightLog.delete({ where: { id } });
  revalidatePath("/");
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
  const valid = rows
    .map((r) => {
      const d = new Date(r.date);
      const kg = Math.round(r.weightKg * 10) / 10;
      const okDate = !Number.isNaN(d.getTime());
      const okKg = Number.isFinite(kg) && kg >= 30 && kg <= 300;
      return okDate && okKg ? { weightKg: kg, loggedAt: d } : null;
    })
    .filter((x): x is { weightKg: number; loggedAt: Date } => x !== null);

  if (valid.length > 0) {
    await db.weightLog.createMany({ data: valid });

    // Sync profile weight to whatever the newest log is now.
    const latest = await db.weightLog.findFirst({
      orderBy: { loggedAt: "desc" },
    });
    if (latest) {
      const profile = await db.profile.findFirst();
      if (profile) {
        await db.profile.update({
          where: { id: profile.id },
          data: { weightKg: latest.weightKg },
        });
      }
    }
  }

  revalidatePath("/");
  return { imported: valid.length, skipped: rows.length - valid.length };
}
