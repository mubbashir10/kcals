"use server";

import { db } from "@/lib/db";
import { isHhmm } from "@/lib/clock";
import { requireUserId } from "@/lib/session";
import { revalidateDiary } from "@/lib/revalidate";

// NOTE: "use server" file — may only export async functions. The row shape
// is internal; consumers derive it via Awaited<ReturnType<typeof
// listDefaultMeals>>[number].
type DefaultMealRow = {
  id: number;
  name: string;
  timeHhmm: string;
  position: number;
};

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Meal name is required");
  if (trimmed.length > 60) throw new Error("Meal name is too long");
  return trimmed;
}

function cleanTime(timeHhmm: string): string {
  if (!isHhmm(timeHhmm)) throw new Error("Invalid time");
  return timeHhmm;
}

function revalidate() {
  // Defaults change what renders on the diary surfaces (placeholder cards)
  // and the editor lives in settings.
  revalidateDiary("/diary", "/settings");
}

export async function listDefaultMeals(): Promise<DefaultMealRow[]> {
  const userId = await requireUserId();
  const rows = await db.defaultMeal.findMany({
    where: { userId },
    orderBy: { position: "asc" },
    select: { id: true, name: true, timeHhmm: true, position: true },
  });
  return rows;
}

export async function addDefaultMeal(name: string, timeHhmm: string) {
  const userId = await requireUserId();
  const data = { name: cleanName(name), timeHhmm: cleanTime(timeHhmm) };
  // Append at the end. Single-user, one-at-a-time edits — no race to design
  // around (same as the recipe-ingredient position scheme).
  const last = await db.defaultMeal.findFirst({
    where: { userId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  await db.defaultMeal.create({
    data: { userId, ...data, position: (last?.position ?? -1) + 1 },
  });
  revalidate();
}

export async function updateDefaultMeal(
  id: number,
  values: { name: string; timeHhmm: string }
) {
  const userId = await requireUserId();
  await db.defaultMeal.updateMany({
    where: { id, userId },
    data: { name: cleanName(values.name), timeHhmm: cleanTime(values.timeHhmm) },
  });
  revalidate();
}

export async function deleteDefaultMeal(id: number) {
  const userId = await requireUserId();
  await db.defaultMeal.deleteMany({ where: { id, userId } });
  revalidate();
}
