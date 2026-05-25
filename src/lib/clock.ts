// Pure timezone helpers — safe to import from client OR server.
// Anything that needs the DB (e.g. resolving the user's stored tz) lives in
// `clock.server.ts` instead.

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

export function greetingInTz(tz: string, ref: Date = new Date()): string {
  const h = hourInTz(ref, tz);
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function autoMealNameInTz(d: Date, tz: string): string {
  const h = hourInTz(d, tz);
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 15) return "Lunch";
  if (h >= 15 && h < 17) return "Snack";
  if (h >= 17 && h < 22) return "Dinner";
  return "Late snack";
}

// Internal: pull discrete Y/M/D/H/M parts of `date` as seen in `tz`.
function getDateParts(date: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

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
