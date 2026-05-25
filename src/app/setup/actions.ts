"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";

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
  const existing = await db.profile.findFirst();
  if (existing) {
    await db.profile.update({
      where: { id: existing.id },
      data: input,
    });
  } else {
    await db.profile.create({ data: input });
  }

  revalidatePath("/");
  redirect("/");
}
