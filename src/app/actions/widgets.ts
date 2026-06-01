"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { revalidateDiary } from "@/lib/revalidate";
import {
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import {
  isLactationBasis,
  isLactationStage,
  isLactationStatus,
  type LactationBasis,
  type LactationStage,
  type LactationStatus,
} from "@/lib/lactation";
import { isMacroMode, MACROS, type Macro, type MacroMode } from "@/lib/macros";
import {
  REORDERABLE_WIDGETS,
  parseWidgetStates,
  type CalorieDisplayMode,
  type MealSortDir,
  type ReorderableWidgetId,
  type UnitsPreference,
  type WidgetId,
  type WidgetState,
} from "@/lib/widget-order";

export async function setWidgetState(id: WidgetId, state: WidgetState) {
  if (!(REORDERABLE_WIDGETS as readonly string[]).includes(id)) {
    throw new Error(`Unknown widget id: ${id}`);
  }
  if (state !== "shown" && state !== "hidden") {
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

export async function setMealSort(dir: MealSortDir) {
  if (dir !== "asc" && dir !== "desc") {
    throw new Error(`Invalid meal sort direction: ${dir}`);
  }
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { mealSortDir: dir },
  });
  revalidateDiary("/diary");
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

export async function setWeekStartDay(day: number) {
  // 0=Sunday … 6=Saturday (JS getUTCDay convention).
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    throw new Error(`Invalid week start day: ${day}`);
  }
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { weekStartDay: day },
  });
  revalidatePath("/week");
  revalidatePath("/settings");
}

export async function setTimezone(tz: string) {
  // IANA tz names are 1..64 chars of [A-Za-z0-9_+-/]; validate cheaply so
  // we don't write garbage into the field that drives every date cutoff.
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(tz)) {
    throw new Error(`Invalid timezone: ${tz}`);
  }
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { timezone: tz },
  });
  revalidatePath("/");
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
  revalidatePath("/goal");
  revalidatePath("/settings");
}

// Breastfeeding settings. status drives the milk-cost bump added to TDEE;
// stage is only meaningful while nursing (cleared otherwise so no stale
// state lingers), and basis chooses full-cost ("maintain") vs the IOM
// gentle-loss figure. See lib/lactation.ts.
export async function setLactation(
  status: LactationStatus,
  stage: LactationStage | null,
  basis: LactationBasis
) {
  if (!isLactationStatus(status)) {
    throw new Error(`Unknown lactation status: ${status}`);
  }
  if (stage != null && !isLactationStage(stage)) {
    throw new Error(`Unknown lactation stage: ${stage}`);
  }
  if (!isLactationBasis(basis)) {
    throw new Error(`Unknown lactation basis: ${basis}`);
  }
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: {
      lactationStatus: status,
      lactationStage: status === "none" ? null : stage ?? "0-6mo",
      lactationBasis: basis,
    },
  });
  revalidatePath("/");
  revalidatePath("/goal");
  revalidatePath("/settings");
}

export async function setTrackKcal(kcal: number | null) {
  // Sanity range: anything outside 800–8000 is almost certainly a typo or
  // bad client state. We don't enforce that macros add to this number —
  // that's a soft warning in the UI.
  let value: number | null = null;
  if (kcal != null) {
    if (!Number.isFinite(kcal) || kcal < 800 || kcal > 8000) {
      throw new Error(`Invalid track kcal target: ${kcal}`);
    }
    value = Math.round(kcal);
  }
  const userId = await requireUserId();
  await db.profile.updateMany({
    where: { userId },
    data: { trackKcal: value },
  });
  revalidatePath("/");
  revalidatePath("/goal");
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
