// Pure timezone helpers — safe to import from client OR server.
// Anything that needs the DB (e.g. resolving the user's stored tz) lives in
// `clock.server.ts` instead.

import { clamp01 } from "@/lib/utils";

// Build a Date that represents 00:00 *local* time in `tz`, expressed as the
// equivalent UTC instant. Used to filter "today's" rows from the DB, where
// loggedAt is stored as UTC. We pick the local Y/M/D using Intl, then offset
// by the timezone's UTC offset at that moment.
export function startOfDayInTz(tz: string, ref: Date = new Date()): Date {
  const { year, month, day } = getDateParts(ref, tz);
  // Construct the UTC midnight for that local Y/M/D, then back out the offset
  // between UTC and tz at that instant to get the true UTC equivalent.
  const utcMidnight = Date.UTC(year, month - 1, day);
  const offsetMs = tzOffsetMs(new Date(utcMidnight), tz);
  return new Date(utcMidnight - offsetMs);
}

// Hour-of-day (0–23) at `date` in the given timezone.
export function hourInTz(date: Date, tz: string): number {
  return getDateParts(date, tz).hour;
}

// Active energy accrues in waking hours, not evenly across the calendar day —
// nobody walks between 2am and 6am. So "how much of this day has been lived"
// measures the waking window rather than midnight to midnight, or every day
// would look two-thirds spent by the time its owner got out of bed.
const WAKING_START_HOUR = 6;
const WAKING_END_HOUR = 23;

/**
 * How much of `ref`'s waking day has passed in `tz`, as 0–1. Zero before the
 * window opens (nothing lived yet), one after it closes (the day's movement is
 * done). Weights the partial-day burn projection — see `dayOutlook` in
 * lib/daily-snapshot.ts.
 */
export function dayElapsedFraction(tz: string, ref: Date = new Date()): number {
  const { hour, minute } = getDateParts(ref, tz);
  const start = WAKING_START_HOUR * 60;
  const end = WAKING_END_HOUR * 60;
  return clamp01((hour * 60 + minute - start) / (end - start));
}

/**
 * The same fraction for a specific calendar day: today is partly lived, and
 * every other day is done. Callers that hold a `dayKey` want this rather than
 * re-deriving "is this today" against `dayKeyInTz` for themselves.
 */
export function elapsedForDayKey(
  tz: string,
  dayKey: string,
  ref: Date = new Date()
): number {
  return dayKey === dayKeyInTz(tz, ref) ? dayElapsedFraction(tz, ref) : 1;
}

// "YYYY-MM-DD" for the calendar day that contains `date` in `tz`. Used as a
// stable per-day key (unique in ActivityLog).
export function dayKeyInTz(tz: string, ref: Date = new Date()): string {
  const { year, month, day } = getDateParts(ref, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Strict "YYYY-MM-DD". Guards untrusted input (route params, POST bodies) so a
// value like "2026-5-1" can't resolve to different days under different
// timezones. Everything else here assumes an already-valid key.
export function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// Parse a "YYYY-MM-DD" key into its parts. Throws on malformed input.
export function parseDayKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map((s) => parseInt(s, 10));
  return { year: y, month: m, day: d };
}

// True when `dayKey` is a calendar day after "today" in `tz`. Used to reject
// logging into the future. Relies on "YYYY-MM-DD" sorting lexicographically.
export function isFutureDayKey(
  tz: string,
  dayKey: string,
  ref: Date = new Date()
): boolean {
  return dayKey > dayKeyInTz(tz, ref);
}

// A UTC instant that lands inside `dayKey`'s calendar day in `tz`, using the
// current wall-clock time-of-day. So a meal or weigh-in logged *for* a past
// day still sorts and auto-names by the moment it was entered, just pinned to
// the chosen date.
export function instantWithinDayInTz(
  tz: string,
  dayKey: string,
  ref: Date = new Date()
): Date {
  const { year, month, day } = parseDayKey(dayKey);
  const { hour, minute } = getDateParts(ref, tz);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(new Date(asUtc), tz);
  return new Date(asUtc - offset);
}

// UTC instant of 00:00 local time in `tz` for the calendar day `dayKey`. Noon
// UTC is safely inside the day for every IANA tz, so it's a stable reference.
export function startOfDayForDayKey(tz: string, dayKey: string): Date {
  const { year, month, day } = parseDayKey(dayKey);
  return startOfDayInTz(tz, new Date(Date.UTC(year, month - 1, day, 12)));
}

// Day key → local Date at 00:00 (local-time, not tz-aware). Use this for
// chart x-axis math and "is same calendar day" comparisons; for absolute
// instants in a specific tz use `startOfDayInTz` instead. For day-key
// arithmetic that must survive DST, use `shiftDayKey` from `calendar-build.ts`.
export function dayKeyToLocalDate(key: string): Date {
  const { year, month, day } = parseDayKey(key);
  return new Date(year, month - 1, day);
}

export function formatTimeInTz(date: Date | string, tz: string): string {
  return new Date(date).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLongDateInTz(date: Date | string, tz: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDateInTz(date: Date | string, tz: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
  });
}

// Calendar year (in `tz`) that `date` falls in. Useful when deciding
// whether to render a year label or omit it.
export function yearInTz(date: Date, tz: string): number {
  return getDateParts(date, tz).year;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How a logged entry's date reads in a history list: "Today", "Yesterday", the
 * weekday name within the past week, then a short date. The year is appended
 * only once it differs from the current one, so recent entries stay compact.
 *
 * `weekday` keeps the weekday name on the dated form too ("Tuesday, Mar 4") —
 * what a day-grouped heading wants, where the row is a whole day rather than
 * one entry among several.
 */
export function formatRelativeDateInTz(
  date: Date,
  tz: string,
  opts: { weekday?: boolean } = {}
): string {
  const now = new Date();
  const startToday = startOfDayInTz(tz, now);
  if (date >= startToday) return "Today";
  if (date >= new Date(startToday.getTime() - DAY_MS)) return "Yesterday";

  const daysAgo = Math.floor(
    (startToday.getTime() - date.getTime()) / DAY_MS
  );
  if (daysAgo < 7) return weekdayFormatter(tz).format(date);

  const sameYear = yearInTz(date, tz) === yearInTz(now, tz);
  return datedFormatter(tz, !!opts.weekday, sameYear).format(date);
}

// Same reason getDateParts caches: constructing a DateTimeFormat is one of the
// slowest hot-path JS APIs, and /calories formats up to 365 rows in one render.
const relativeFormatters = new Map<string, Intl.DateTimeFormat>();
function cachedFormat(
  key: string,
  make: () => Intl.DateTimeFormat
): Intl.DateTimeFormat {
  let f = relativeFormatters.get(key);
  if (!f) {
    f = make();
    relativeFormatters.set(key, f);
  }
  return f;
}

function weekdayFormatter(tz: string): Intl.DateTimeFormat {
  return cachedFormat(`wd:${tz}`, () =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" })
  );
}

function datedFormatter(
  tz: string,
  weekday: boolean,
  sameYear: boolean
): Intl.DateTimeFormat {
  return cachedFormat(`dt:${tz}:${weekday}:${sameYear}`, () =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: weekday ? "long" : undefined,
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    })
  );
}

/** A dayKey's noon-UTC instant — lands on the right calendar day in any tz. */
export function dayKeyToNoonUtc(dayKey: string): Date {
  const { year, month, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function greetingInTz(tz: string, ref: Date = new Date()): string {
  const h = hourInTz(ref, tz);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Return "HH:mm" (24-hour) for `date` rendered in `tz` — suitable for an
// <input type="time"> value.
export function timeInputValueInTz(date: Date | string, tz: string): string {
  const { hour, minute } = getDateParts(new Date(date), tz);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// True for a 24-hour "HH:MM" string — the value shape of <input type="time">
// and the format meals/default-meals store and parse.
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isHhmm(s: string): boolean {
  return HHMM_RE.test(s);
}

// UTC instant that lands on the calendar day `dayKey` at local time `hhmm`
// in `tz`. The building block for moving/copying a meal to an explicit
// date + time.
export function instantOnDayInTz(
  tz: string,
  dayKey: string,
  hhmm: string
): Date {
  const { year, month, day } = parseDayKey(dayKey);
  const [hStr, mStr] = hhmm.split(":");
  const hour = Math.max(0, Math.min(23, parseInt(hStr ?? "0", 10) || 0));
  const minute = Math.max(0, Math.min(59, parseInt(mStr ?? "0", 10) || 0));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(new Date(asUtc), tz);
  return new Date(asUtc - offset);
}

// Given a reference date (whose calendar day in `tz` we want to keep) and an
// "HH:mm" string, return the UTC Date that lands on that local day at that
// local time.
export function setTimeOnDateInTz(
  ref: Date | string,
  tz: string,
  hhmm: string
): Date {
  return instantOnDayInTz(tz, dayKeyInTz(tz, new Date(ref)), hhmm);
}

export function autoMealNameInTz(d: Date, tz: string): string {
  const h = hourInTz(d, tz);
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 15) return "Lunch";
  if (h >= 15 && h < 17) return "Snack";
  if (h >= 17 && h < 22) return "Dinner";
  return "Late snack";
}

// Cache one DateTimeFormat per tz — these are non-trivially expensive to
// construct (one of the slowest hot-path JS APIs on V8), and we call
// getDateParts in tight per-row loops in loadDailyHistory and friends.
const datePartsFormatters = new Map<string, Intl.DateTimeFormat>();
function getDatePartsFormatter(tz: string): Intl.DateTimeFormat {
  let f = datePartsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    datePartsFormatters.set(tz, f);
  }
  return f;
}

// Internal: pull discrete Y/M/D/H/M parts of `date` as seen in `tz`.
function getDateParts(date: Date, tz: string) {
  const parts = getDatePartsFormatter(tz).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  // Intl returns hour 24 for midnight on some implementations; normalize.
  const hour = get("hour") % 24;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}

// How many ms ahead of UTC is `tz` at `date`? Positive for east of UTC.
function tzOffsetMs(date: Date, tz: string): number {
  const { year, month, day, hour, minute } = getDateParts(date, tz);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Floor to the minute on the actual instant so subtraction is clean.
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return asIfUtc - actual;
}
