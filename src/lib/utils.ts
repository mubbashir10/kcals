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
