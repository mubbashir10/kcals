"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { dayKeyInTz } from "@/lib/clock";
import { requireUserId } from "@/lib/session";

export type ActivityMode = "estimate" | "override";

export type ActivityLogInput = {
  mode: ActivityMode;
  steps?: number | null;
  liftingMin?: number | null;
  cardioMin?: number | null;
  wearableKcal?: number | null;
};

function sanitizeInt(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Math.round(value);
  if (v < min || v > max) return null;
  return v;
}

export async function upsertTodayActivity(input: ActivityLogInput) {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  const tz = profile?.timezone || "UTC";
  const key = dayKeyInTz(tz);

  const mode: ActivityMode = input.mode === "override" ? "override" : "estimate";

  const data =
    mode === "override"
      ? {
          mode,
          steps: null,
          liftingMin: null,
          cardioMin: null,
          wearableKcal: sanitizeInt(input.wearableKcal, 0, 10000),
        }
      : {
          mode,
          steps: sanitizeInt(input.steps, 0, 200000),
          liftingMin: sanitizeInt(input.liftingMin, 0, 600),
          cardioMin: sanitizeInt(input.cardioMin, 0, 600),
          wearableKcal: null,
        };

  await db.activityLog.upsert({
    where: { userId_dayKey: { userId, dayKey: key } },
    create: { userId, dayKey: key, ...data },
    update: data,
  });

  revalidatePath("/");
}

export async function deleteTodayActivity() {
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({ where: { userId } });
  const tz = profile?.timezone || "UTC";
  const key = dayKeyInTz(tz);

  await db.activityLog.deleteMany({ where: { userId, dayKey: key } });
  revalidatePath("/");
}
