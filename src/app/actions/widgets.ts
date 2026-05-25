"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import {
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { isMacroMode, MACROS, type Macro, type MacroMode } from "@/lib/macros";
import {
  REORDERABLE_WIDGETS,
  parseWidgetStates,
  type CalorieDisplayMode,
  type ReorderableWidgetId,
  type UnitsPreference,
  type WidgetId,
  type WidgetState,
} from "@/lib/widget-order";

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

export async function setCalorieDisplay(mode: CalorieDisplayMode) {
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { calorieDisplay: mode },
  });
  revalidatePath("/");
}

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

export async function setGoal(type: GoalType, pace: GoalPace | null) {
  if (!isGoalType(type)) {
    throw new Error(`Unknown goal type: ${type}`);
  }
  if (pace != null && !isGoalPace(pace)) {
    throw new Error(`Unknown goal pace: ${pace}`);
  }
  // Pace only meaningful for loss/gain; clear it otherwise so we don't keep
  // stale pace state lying around when the user switches to maintain/track.
  const normalizedPace = type === "loss" || type === "gain" ? pace : null;
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { goalType: type, goalPace: normalizedPace },
  });
  revalidatePath("/");
  revalidatePath("/settings");
}

const MACRO_FIELDS: Record<
  Macro,
  { mode: "proteinGoalMode" | "carbsGoalMode" | "fatGoalMode"; g: "proteinGoalG" | "carbsGoalG" | "fatGoalG" }
> = {
  protein: { mode: "proteinGoalMode", g: "proteinGoalG" },
  carbs: { mode: "carbsGoalMode", g: "carbsGoalG" },
  fat: { mode: "fatGoalMode", g: "fatGoalG" },
};

export async function setMacroGoal(
  macro: Macro,
  mode: MacroMode,
  grams: number | null
) {
  if (!(MACROS as readonly string[]).includes(macro)) {
    throw new Error(`Unknown macro: ${macro}`);
  }
  if (!isMacroMode(mode)) {
    throw new Error(`Unknown macro mode: ${mode}`);
  }
  // Custom requires a non-negative integer; clear out grams for auto/off so
  // we never leave stale numbers behind.
  const customG =
    mode === "custom" && grams != null && grams >= 0 && grams < 2000
      ? Math.round(grams)
      : null;
  const userId = await requireUserId();
  const fields = MACRO_FIELDS[macro];
  await db.profile.updateMany({
    where: { userId },
    data: { [fields.mode]: mode, [fields.g]: customG },
  });
  revalidatePath("/");
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
