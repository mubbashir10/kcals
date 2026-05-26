"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";

// Profile setup covers body data, timezone, and activity. Macros and
// goal type/pace fall back to schema defaults; both are editable in
// /settings after onboarding.
export type SaveProfileInput = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  units: "metric" | "imperial";
  timezone: string;
  activityMode: "estimate" | "override";
  stepsPerDay: number | null;
  liftingSessionsPerWeek: number | null;
  liftingMinutesPerSession: number | null;
  cardioSessionsPerWeek: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
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
