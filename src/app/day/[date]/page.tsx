import { notFound } from "next/navigation";

import { DayDashboard } from "@/components/day-dashboard";
import { BrandHeader } from "@/components/brand-header";
import { UserMenu } from "@/components/user-menu";
import { loadDayDetail } from "@/lib/day-detail";
import { loadDayMealItems } from "@/lib/default-meals";
import { loadWeekSummary } from "@/lib/week";
import { listFriendSummaries } from "@/lib/friends";
import { requireProfile } from "@/lib/session";
import { normalizeMealSort } from "@/lib/widget-order";
import {
  autoMealNameInTz,
  dayKeyInTz,
  formatLongDateInTz,
  isDayKey,
  startOfDayForDayKey,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dayKey } = await params;
  if (!isDayKey(dayKey)) notFound();

  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const now = new Date();
  const todayKey = dayKeyInTz(tz, now);
  const isToday = dayKey === todayKey;

  const detail = await loadDayDetail(userId, profile, dayKey);

  const [mealItems, weekSummary, friendSummaries] = await Promise.all([
    loadDayMealItems({
      userId,
      meals: detail.meals,
      dayKey,
      todayKey,
      tz,
      sortDir: normalizeMealSort(profile.mealSortDir),
    }),
    loadWeekSummary(userId, profile, dayKey, now),
    listFriendSummaries(userId, now),
  ]);

  const dateLabel = formatLongDateInTz(startOfDayForDayKey(tz, dayKey), tz);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <BrandHeader>
          <UserMenu />
        </BrandHeader>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-8 pt-6 sm:px-6 lg:max-w-5xl">
        <h1 className="mb-5 text-balance font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {isToday ? "Today" : dateLabel}.
        </h1>

        <DayDashboard
          dayKey={dayKey}
          todayKey={todayKey}
          isToday={isToday}
          tz={tz}
          profile={profile}
          stats={{
            consumed: detail.consumed,
            calorieGoal: detail.calorieGoal,
            macroGoals: detail.macroGoals,
            bmr: detail.bmr,
            active: detail.active,
            tdee: detail.tdeeKcal,
            lactationKcal: detail.lactationKcal,
            goalType: detail.goalType,
            kcalOffset: detail.kcalOffset,
            activity: detail.activityLog,
            sourceIcon: detail.sourceIcon,
            latestWeight: detail.latestWeight,
            delta7dKg: detail.delta7dKg,
          }}
          weekSummary={weekSummary}
          mealItems={mealItems}
          mealsCount={detail.meals.length}
          foodCount={detail.foodCount}
          suggestedMealName={autoMealNameInTz(now, tz)}
          friendSummaries={friendSummaries}
        />
      </main>
    </div>
  );
}
