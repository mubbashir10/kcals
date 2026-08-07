import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round to 1 decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// PostgreSQL `Int` (int4) bounds. Search results carry synthetic negative
// fdcIds as display-only React keys (recipes, Open Food Facts, AI previews,
// and curated local "Reference" rows). Local rows sit near -3e9, which is
// BELOW int4's minimum — writing one to Food.fdcId / RecipeIngredient.fdcId
// throws "value out of range for type integer". These synthetic ids are
// never resolved back to a real source, so anything outside int4 is dropped
// to null (the column's "no real reference" value) at the write boundary.
const INT4_MIN = -2_147_483_648;
const INT4_MAX = 2_147_483_647;

/**
 * Returns `fdcId` only when it's a real, storable reference (a positive USDA
 * id or a `-customFoodId` pointer that fits int4). Out-of-range synthetic
 * display ids become null. Apply before persisting a logged food/ingredient.
 */
export function persistableFdcId(fdcId: number | null): number | null {
  if (fdcId == null || !Number.isInteger(fdcId)) return null;
  if (fdcId < INT4_MIN || fdcId > INT4_MAX) return null;
  return fdcId;
}

/**
 * True when `err` is the control-flow throw from a server action's
 * `redirect()` — i.e. the success path, not a failure. Use to skip
 * error-reporting on the happy path inside a server-action `catch`.
 */
export function isNextRedirectError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("NEXT_REDIRECT");
}

/** Round to `dp` decimal places. */
export function roundN(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Progress toward a goal as a 0–100 percentage. Capped at 100 — going over is
 * real and the numbers say so, but a bar can't render past full.
 */
export function percentOfGoal(
  value: number,
  goal: number | null | undefined
): number {
  if (goal == null || goal <= 0) return 0;
  return Math.min((value / goal) * 100, 100);
}

/** Sum `rows.map(r => r[key])`, treating null/undefined as 0. */
export function sumBy<K extends string>(
  rows: ReadonlyArray<{ [P in K]?: number | null }>,
  key: K
): number {
  return rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
}

/**
 * Parse an optional non-negative integer from form input. Empty → null (a
 * valid "left blank"); a number outside [0, max] → "invalid" so the caller
 * can surface an error. Distinguishing the two is why this isn't
 * `parseFiniteNumber`.
 */
export function parseOptionalInt(
  v: string,
  max: number
): number | null | "invalid" {
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n < 0 || n > max) return "invalid";
  return n;
}

/**
 * Lenient read of a numeric field — anything unusable reads as blank.
 *
 * For the places a number is *used* rather than validated: a live estimate has
 * to survive half-typed input without throwing an error at someone mid-
 * keystroke, and a field the current form mode doesn't show can't be validated
 * with a message, because there's nothing on screen to fix. Submit validates
 * what's visible; this handles the rest.
 */
export function looseInt(value: string, min: number, max: number): number | null {
  const n = parseInt(value.trim(), 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** The value if it's a finite number, else null — for JSON-shape guards. */
export function finiteNumberOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Parse a string into a finite number, optionally bounded. Returns null if
 * the string is empty, not a number, or out of range. Use at form-input
 * boundaries where partial entries like "1." or "" are expected.
 */
export function parseFiniteNumber(
  s: string,
  opts?: { min?: number; max?: number }
): number | null {
  if (s.trim() === "") return null;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  if (opts?.min != null && n < opts.min) return null;
  if (opts?.max != null && n > opts.max) return null;
  return n;
}
