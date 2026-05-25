"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  REORDERABLE_WIDGETS,
  parseWidgetStates,
  type ReorderableWidgetId,
  type WidgetState,
} from "@/lib/widget-order";

export type WidgetId = ReorderableWidgetId;
export type { WidgetState };

export async function setWidgetState(id: WidgetId, state: WidgetState) {
  if (!(REORDERABLE_WIDGETS as readonly string[]).includes(id)) {
    throw new Error(`Unknown widget id: ${id}`);
  }
  if (state !== "expanded" && state !== "minimized" && state !== "hidden") {
    throw new Error(`Invalid widget state: ${state}`);
  }
  const userId = await requireUserId();
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { widgetStates: true },
  });
  if (!profile) return;

  const next = { ...parseWidgetStates(profile.widgetStates), [id]: state };
  await db.profile.updateMany({
    where: { userId },
    data: { widgetStates: JSON.stringify(next) },
  });
  revalidatePath("/");
}

export type CalorieDisplayMode = "remaining" | "consumed";

export async function setCalorieDisplay(mode: CalorieDisplayMode) {
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { calorieDisplay: mode },
  });
  revalidatePath("/");
}

export type UnitsPreference = "metric" | "imperial";

export async function setUnits(units: UnitsPreference) {
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { units },
  });
  revalidatePath("/");
  revalidatePath("/weight");
  revalidatePath("/settings");
}

export async function setWidgetOrder(order: ReorderableWidgetId[]) {
  const userId = await requireUserId();
  // Sanitize: drop unknowns + duplicates, then ensure all known ids are present
  const seen = new Set<ReorderableWidgetId>();
  const sanitized: ReorderableWidgetId[] = [];
  for (const id of order) {
    if (
      (REORDERABLE_WIDGETS as readonly string[]).includes(id) &&
      !seen.has(id)
    ) {
      sanitized.push(id);
      seen.add(id);
    }
  }
  for (const id of REORDERABLE_WIDGETS) {
    if (!seen.has(id)) sanitized.push(id);
  }
  await db.profile.updateMany({
    where: { userId },
    data: { widgetOrder: JSON.stringify(sanitized) },
  });
  revalidatePath("/");
}
