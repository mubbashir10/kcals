import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Round to 1 decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Round to `dp` decimal places. */
export function roundN(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Sum `rows.map(r => r[key])`, treating null/undefined as 0. */
export function sumBy<K extends string>(
  rows: ReadonlyArray<{ [P in K]?: number | null }>,
  key: K
): number {
  return rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
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
