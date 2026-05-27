// Pure date helpers shared by the calendar surfaces (widget + /calendar
// page + MarkerCalendar). No DB access — safe to import client-side.

import { parseDayKey } from "./clock";

export function shiftMonth(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map((s) => parseInt(s, 10));
  const total = y * 12 + (m - 1) + deltaMonths;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function shiftDayKey(dayKey: string, deltaDays: number): string {
  // Internal arithmetic stays in UTC to avoid DST-induced day skips.
  const { year, month, day } = parseDayKey(dayKey);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

// Date → "YYYY-MM-DD" using the date's *local* calendar fields. Pair this
// with Dates constructed via `new Date(y, m-1, d)` (also local) — e.g. the
// Date instances react-day-picker hands to a custom DayButton.
export function formatYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Month label in the user's tz — "May 2026".
export function formatMonthLabel(monthKey: string, tz: string): string {
  const [y, m] = monthKey.split("-").map((s) => parseInt(s, 10));
  const date = new Date(Date.UTC(y, m - 1, 1, 12));
  return date.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "long",
    year: "numeric",
  });
}
