import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { AddFoodClient, type MealOption } from "./add-food-client";
import { autoMealNameInTz, startOfDayInTz } from "@/lib/clock";

export const dynamic = "force-dynamic";

const MEAL_JOIN_WINDOW_MS = 2 * 60 * 60 * 1000;

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>;
}) {
  const profile = await db.profile.findFirst();
  if (!profile) redirect("/setup");

  const tz = profile.timezone || "UTC";
  const now = new Date();

  const sp = await searchParams;
  const requestedMealId = sp.meal ? parseInt(sp.meal, 10) : null;

  const meals = await db.meal.findMany({
    where: { loggedAt: { gte: startOfDayInTz(tz, now) } },
    orderBy: { loggedAt: "desc" },
    include: { foods: { select: { kcal: true } } },
  });

  // Pick the default target:
  //   1. ?meal=<id> if it exists in today's meals
  //   2. most recent meal within the join window
  //   3. otherwise null (creates a new meal)
  const requestedExists =
    requestedMealId != null && meals.some((m) => m.id === requestedMealId);
  const cutoff = new Date(Date.now() - MEAL_JOIN_WINDOW_MS);
  const autoTargetId = requestedExists
    ? requestedMealId
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
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.92_0.06_70_/_0.5)_0%,transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.35_0.08_40_/_0.3)_0%,transparent_70%)]"
      />
      <AddFoodClient
        meals={mealOptions}
        autoTargetId={autoTargetId}
        suggestedNewMealName={autoMealNameInTz(now, tz)}
        timezone={tz}
      />
    </div>
  );
}
