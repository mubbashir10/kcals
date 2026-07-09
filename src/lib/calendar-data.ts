// Data fetchers for the calendar grid — markers for which days have food,
// weight, or activity logged. Used by the home calendar widget and the
// full /calendar page.

import { db } from "@/lib/db";
import { dayKeyInTz, parseDayKey } from "@/lib/clock";
import {
  FOOD_MEAL_DAY_SELECT,
  foodDayKey,
  foodsOfMealsInRange,
} from "@/lib/food-day";

export type DayMarker = {
  dayKey: string;
  hasFood: boolean;
  hasWeight: boolean;
  hasActivity: boolean;
  consumedKcal: number;
};

// Fetch markers covering the inclusive [startKey, endKey] range. Both keys
// are "YYYY-MM-DD" in the user's timezone.
export async function loadDayMarkers(
  userId: string,
  startKey: string,
  endKey: string,
  tz: string
): Promise<Map<string, DayMarker>> {
  // Range in UTC instants — generous bounds since a tz-day can span across
  // the UTC midnight either way.
  const start = utcStartOfRange(startKey);
  const end = utcEndOfRange(endKey);

  const [foods, activityLogs, weightLogs] = await Promise.all([
    db.food.findMany({
      where: foodsOfMealsInRange(userId, start, end),
      select: { kcal: true, ...FOOD_MEAL_DAY_SELECT },
    }),
    db.activityLog.findMany({
      where: { userId, dayKey: { gte: startKey, lte: endKey } },
      select: {
        dayKey: true,
        steps: true,
        liftingMin: true,
        cardioMin: true,
        wearableKcal: true,
      },
    }),
    db.weightLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      select: { loggedAt: true },
    }),
  ]);

  const markers = new Map<string, DayMarker>();
  const get = (key: string): DayMarker => {
    let m = markers.get(key);
    if (!m) {
      m = {
        dayKey: key,
        hasFood: false,
        hasWeight: false,
        hasActivity: false,
        consumedKcal: 0,
      };
      markers.set(key, m);
    }
    return m;
  };

  for (const f of foods) {
    const key = foodDayKey(tz, f);
    if (key < startKey || key > endKey) continue;
    const m = get(key);
    m.hasFood = true;
    m.consumedKcal += f.kcal;
  }

  for (const a of activityLogs) {
    const has =
      (a.steps ?? 0) > 0 ||
      (a.liftingMin ?? 0) > 0 ||
      (a.cardioMin ?? 0) > 0 ||
      (a.wearableKcal ?? 0) > 0;
    if (!has) continue;
    const m = get(a.dayKey);
    m.hasActivity = true;
  }

  for (const w of weightLogs) {
    const key = dayKeyInTz(tz, w.loggedAt);
    if (key < startKey || key > endKey) continue;
    const m = get(key);
    m.hasWeight = true;
  }

  return markers;
}

// Padding heuristic — a tz-day overlaps with UTC for at most ~14h on either
// side (Pacific/Kiritimati = UTC+14, Pacific/Pago Pago = UTC-11). One full
// day on each end is safe overshoot, and we filter precisely with the
// per-row dayKey check above.
function utcStartOfRange(startKey: string): Date {
  const { year, month, day } = parseDayKey(startKey);
  return new Date(Date.UTC(year, month - 1, day - 1));
}

function utcEndOfRange(endKey: string): Date {
  const { year, month, day } = parseDayKey(endKey);
  return new Date(Date.UTC(year, month - 1, day + 2));
}
