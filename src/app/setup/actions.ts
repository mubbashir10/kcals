"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import type { GoalPace, GoalType } from "@/lib/goal";
import type { MacroMode } from "@/lib/macros";

export type SaveProfileInput = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number | null;
  units: "metric" | "imperial";
  timezone: string;
  goalType: GoalType;
  goalPace: GoalPace | null;
  proteinGoalMode: MacroMode;
  proteinGoalG: number | null;
  carbsGoalMode: MacroMode;
  carbsGoalG: number | null;
  fatGoalMode: MacroMode;
  fatGoalG: number | null;
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
