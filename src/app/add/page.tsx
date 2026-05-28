import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { AddFoodClient, type MealOption } from "./add-food-client";
import {
  autoMealNameInTz,
  dayKeyInTz,
  startOfDayForDayKey,
  startOfDayInTz,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

const MEAL_JOIN_WINDOW_MS = 2 * 60 * 60 * 1000;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// UTC window [start, end) covering `dayKey`'s calendar day in `tz`.
function dayWindow(tz: string, dayKey: string): { start: Date; end: Date } {
  const start = startOfDayForDayKey(tz, dayKey);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string; day?: string }>;
}) {
  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const now = new Date();

  const sp = await searchParams;
  const requestedMealId = sp.meal ? parseInt(sp.meal, 10) : null;

  // Which day are we adding to? A valid `?day=` that isn't today scopes the
  // whole flow to that past day; otherwise we're logging for today.
  const todayKey = dayKeyInTz(tz, now);
  const dayParam =
    sp.day && DAY_KEY_RE.test(sp.day) && sp.day !== todayKey ? sp.day : null;

  const window = dayParam
    ? dayWindow(tz, dayParam)
    : { start: startOfDayInTz(tz, now), end: null as Date | null };

  const meals = await db.meal.findMany({
    where: {
      userId,
      loggedAt: {
        gte: window.start,
        ...(window.end ? { lt: window.end } : {}),
      },
    },
    orderBy: { loggedAt: "desc" },
    include: { foods: { select: { kcal: true } } },
  });

  // Pick the default target:
  //   1. ?meal=<id> if it exists in the day's meals
  //   2. (today only) most recent meal within the join window
  //   3. otherwise null (creates a new meal)
  const requestedExists =
    requestedMealId != null && meals.some((m) => m.id === requestedMealId);
  const cutoff = new Date(now.getTime() - MEAL_JOIN_WINDOW_MS);
  const autoTargetId = requestedExists
    ? requestedMealId
    : dayParam
    ? null
    : meals.find((m) => new Date(m.loggedAt) >= cutoff)?.id ?? null;

  const mealOptions: MealOption[] = meals.map((m) => ({
    id: m.id,
    name: m.name,
    loggedAt: m.loggedAt.toISOString(),
    foodCount: m.foods.length,
    kcal: m.foods.reduce((a, f) => a + f.kcal, 0),
  }));

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />
      <AddFoodClient
        meals={mealOptions}
        autoTargetId={autoTargetId}
        suggestedNewMealName={autoMealNameInTz(now, tz)}
        timezone={tz}
        dayKey={dayParam}
      />
    </div>
  );
}
