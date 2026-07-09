// Pure helpers for the home dashboard widget order — split out from
// the server-action file so they can be imported by client components
// and React Server Components alike.

// Every widget on the home page that participates in drag-to-reorder.
// Order here is the default first-time-user order.
export const REORDERABLE_WIDGETS = [
  "maintenance",
  "activity",
  "weight",
  "week",
  "meals",
  "friends",
] as const;
export type ReorderableWidgetId = (typeof REORDERABLE_WIDGETS)[number];
export type WidgetId = ReorderableWidgetId;

export type WidgetState = "shown" | "hidden";

export type CalorieDisplayMode = "remaining" | "consumed";
export type { Units as UnitsPreference } from "@/lib/bmr";

// Order meals are listed in by their logged time.
export type MealSortDir = "asc" | "desc";

// Narrow the profile's stored string to a valid direction. Anything other
// than "asc" falls back to "desc" (newest first, the default).
export function normalizeMealSort(value: string | null | undefined): MealSortDir {
  return value === "asc" ? "asc" : "desc";
}

// Widgets the user can hide. Update this list to match what
// WidgetsSettings offers.
export const HIDEABLE_WIDGETS: readonly ReorderableWidgetId[] = [
  "maintenance",
  "activity",
  "weight",
  "week",
  "meals",
  "friends",
];

// Default state for each widget when the user hasn't picked one yet.
const DEFAULT_STATE: WidgetState = "shown";

export type WidgetStates = Partial<Record<ReorderableWidgetId, WidgetState>>;

export function parseWidgetStates(
  stored: string | null | undefined
): WidgetStates {
  if (typeof stored !== "string" || stored.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const result: WidgetStates = {};
  for (const id of REORDERABLE_WIDGETS) {
    const v = (parsed as Record<string, unknown>)[id];
    // Migrate the legacy three-state model: "expanded"/"minimized" both
    // collapse to "shown".
    if (v === "hidden") result[id] = "hidden";
    else if (v === "shown" || v === "expanded" || v === "minimized")
      result[id] = "shown";
  }
  return result;
}

export function getWidgetState(
  states: WidgetStates,
  id: ReorderableWidgetId
): WidgetState {
  return states[id] ?? DEFAULT_STATE;
}

/**
 * Parse a stored widget-order JSON string. Returns a normalized list that:
 * - contains every reorderable id exactly once
 * - preserves the user's saved order for known ids
 * - falls back to the default order for missing/invalid entries
 */
export function parseWidgetOrder(
  stored: string | null | undefined
): ReorderableWidgetId[] {
  let parsed: unknown = null;
  if (typeof stored === "string" && stored.length > 0) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = null;
    }
  }
  const seen = new Set<ReorderableWidgetId>();
  const result: ReorderableWidgetId[] = [];
  if (Array.isArray(parsed)) {
    for (const id of parsed) {
      if (
        typeof id === "string" &&
        (REORDERABLE_WIDGETS as readonly string[]).includes(id) &&
        !seen.has(id as ReorderableWidgetId)
      ) {
        result.push(id as ReorderableWidgetId);
        seen.add(id as ReorderableWidgetId);
      }
    }
  }
  for (const id of REORDERABLE_WIDGETS) {
    if (!seen.has(id)) result.push(id);
  }
  return result;
}
