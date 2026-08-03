import { notFound } from "next/navigation";

import { DayDashboard } from "@/components/day-dashboard";
import { Logo } from "@/components/logo";
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
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-6">
          <div className="flex items-center">
            <Logo className="h-9 w-9" />
            <span className="translate-y-[5px] bg-gradient-to-b from-lime-400 to-emerald-500 bg-clip-text text-2xl font-semibold leading-none tracking-tight text-transparent">
              kcals
            </span>
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {isToday ? "Today" : dateLabel}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here&apos;s how this day went.
          </p>
        </div>

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
