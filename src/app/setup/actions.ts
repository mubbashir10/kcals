"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { revalidateDiary } from "@/lib/revalidate";
import {
  BODY_FAT_MAX_PCT,
  BODY_FAT_MIN_PCT,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  isSex,
  type Sex,
  type Units,
} from "@/lib/bmr";

// Profile setup covers body data, timezone, and activity. Macros and
// goal type/pace fall back to schema defaults; both are editable in
// /settings after onboarding.
export type SaveProfileInput = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  units: Units;
  timezone: string;
  stepsPerDay: number | null;
  liftingSessionsPerWeek: number | null;
  liftingMinutesPerSession: number | null;
  cardioSessionsPerWeek: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
  lactationStatus: string;
  lactationStage: string | null;
  lactationBasis: string;
};

export async function saveProfile(input: SaveProfileInput) {
  const userId = await requireUserId();
  await db.profile.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });

  revalidatePath("/");
  redirect("/");
}

// The setup form's bounds for each field a partial edit may touch. Height and
// body fat are the only fractional ones; age and height can't be cleared.
const PATCH_BOUNDS = {
  age: [13, 120],
  heightCm: [HEIGHT_MIN_CM, HEIGHT_MAX_CM],
  bodyFatPct: [BODY_FAT_MIN_PCT, BODY_FAT_MAX_PCT],
  stepsPerDay: [0, 100000],
  liftingSessionsPerWeek: [0, 21],
  liftingMinutesPerSession: [1, 300],
  cardioSessionsPerWeek: [0, 21],
  cardioMinutesPerSession: [1, 300],
  activeKcalOverride: [0, 4000],
} as const;
const FRACTIONAL = new Set(["heightCm", "bodyFatPct"]);
const REQUIRED = new Set(["age", "heightCm"]);

type ProfilePatch = { sex?: Sex } & {
  [K in keyof typeof PATCH_BOUNDS]?: number | null;
};

/**
 * Change any subset of the body and typical-day fields without going through
 * the whole setup form — what an assistant does over MCP. Fields left out
 * stay as they are; null clears an optional one.
 */
export async function updateProfile(patch: ProfilePatch) {
  // Built field by field from the known keys: this is a public endpoint, so
  // whatever else the object carries must never reach the row.
  const data: Record<string, unknown> = {};
  if (patch.sex !== undefined) {
    if (!isSex(patch.sex)) throw new Error("Invalid sex");
    data.sex = patch.sex;
  }
  for (const [key, [min, max]] of Object.entries(PATCH_BOUNDS)) {
    const value = patch[key as keyof typeof PATCH_BOUNDS];
    if (value === undefined) continue;
    if (value === null) {
      if (REQUIRED.has(key)) throw new Error(`${key} can't be cleared`);
      data[key] = null;
      continue;
    }
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} must be ${min}–${max}`);
    }
    data[key] = FRACTIONAL.has(key) ? value : Math.round(value);
  }
  if (Object.keys(data).length === 0) return;

  const userId = await requireUserId();
  await db.profile.update({ where: { userId }, data });
  revalidateDiary("/settings", "/goal");
}
