// Pure helpers for the home dashboard widget order — split out from
// the server-action file so they can be imported by client components
// and React Server Components alike.

// Every widget on the home page that participates in drag-to-reorder.
// Order here is the default first-time-user order.
export const REORDERABLE_WIDGETS = [
  "calorie",
  "macros",
  "maintenance",
  "activity",
  "weight",
  "meals",
  "friends",
] as const;
export type ReorderableWidgetId = (typeof REORDERABLE_WIDGETS)[number];

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
