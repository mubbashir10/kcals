import { listMealsOnDay } from "@/app/actions/meals";
import {
  autoMealNameInTz,
  dayKeyInTz,
  isDayKey,
  isFutureDayKey,
} from "@/lib/clock";
import { requireProfile } from "@/lib/session";

import { DescribeClient } from "./describe-client";

export const dynamic = "force-dynamic";

export default async function DescribePage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const now = new Date();
  const todayKey = dayKeyInTz(tz, now);

  const sp = await searchParams;
  // A day we can't log to (malformed, or in the future) falls back to today
  // rather than erroring — the flow is the point, not the query string.
  const dayKey =
    sp.day && isDayKey(sp.day) && !isFutureDayKey(tz, sp.day)
      ? sp.day
      : todayKey;

  // Real meals on the day plus, on today, the default-meal placeholders —
  // so a dump that says "breakfast" can land in the Breakfast card that's
  // already sitting on the dashboard waiting for food.
  const mealOptions = await listMealsOnDay(dayKey);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />
      <DescribeClient
        mealOptions={mealOptions}
        dayKey={dayKey}
        isToday={dayKey === todayKey}
        timezone={tz}
        suggestedMealName={autoMealNameInTz(now, tz)}
      />
    </div>
  );
}
