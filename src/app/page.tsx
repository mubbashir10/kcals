import { redirect } from "next/navigation";

import { DayDashboard } from "@/components/day-dashboard";
import { IncomingInviteBanner } from "@/components/incoming-invite-banner";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { getWidgetState, normalizeMealSort, parseWidgetStates } from "@/lib/widget-order";
import { listFriendSummaries, pendingInvitesForUser } from "@/lib/friends";
import { getSession } from "@/lib/session";
import { loadDailyStats } from "@/lib/daily-stats";
import { loadWeekSummary } from "@/lib/week";
import {
  autoMealNameInTz,
  dayKeyInTz,
  formatLongDateInTz,
  greetingInTz,
} from "@/lib/clock";
import { loadDayMealItems } from "@/lib/default-meals";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const userEmail = session.user.email ?? null;

  const now = new Date();

  // Friends + invites don't need `tz` from this user's profile (friends
  // resolve their own tz, invites are by email), so kick them off in
  // parallel with the main stats fetch instead of waiting on it.
  const friendSummariesPromise = listFriendSummaries(userId, now);
  const incomingInvitesPromise = userEmail
    ? pendingInvitesForUser(userEmail)
    : Promise.resolve([]);

  const stats = await loadDailyStats(userId, now);
  if (!stats) redirect("/setup");

  const {
    profile,
    tz,
    bmr,
    active,
    tdee,
    lactationKcal,
    calorieGoal,
    goalType,
    kcalOffset,
    todayActivity,
    meals,
    latestWeight,
    delta7dKg,
    consumed,
    foodCount,
    macroGoals,
  } = stats;

  const widgetStates = parseWidgetStates(profile.widgetStates);
  const weekState = getWidgetState(widgetStates, "week");
  const mealsState = getWidgetState(widgetStates, "meals");

  const todayKey = dayKeyInTz(tz, now);

  // Real meals + today's default-meal placeholders, merged and time-sorted.
  // The query is skipped when the meals section is hidden.
  const mealItems = await loadDayMealItems({
    userId,
    meals,
    dayKey: todayKey,
    todayKey,
    tz,
    sortDir: normalizeMealSort(profile.mealSortDir),
    enabled: mealsState !== "hidden",
  });

  // Week summary — skip the fetch when the widget is hidden.
  const weekSummaryPromise =
    weekState === "hidden"
      ? Promise.resolve(null)
      : loadWeekSummary(userId, profile, null, now);

  const [friendSummaries, incomingInvites, weekSummary] = await Promise.all([
    friendSummariesPromise,
    incomingInvitesPromise,
    weekSummaryPromise,
  ]);

  const dateStr = formatLongDateInTz(now, tz);

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
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
              {dateStr}
            </span>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {greetingInTz(tz, now)}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here&apos;s where you stand today.
          </p>
        </div>

        {incomingInvites.length > 0 && (
          <div className="mb-6 space-y-2">
            {incomingInvites.map((inv) => (
              <IncomingInviteBanner
                key={inv.id}
                invite={{
                  id: inv.id,
                  token: inv.token,
                  inviterName: inv.inviter.name,
                  inviterEmail: inv.inviter.email,
                  inviterImage: inv.inviter.image,
                }}
              />
            ))}
          </div>
        )}

        <DayDashboard
          dayKey={todayKey}
          todayKey={todayKey}
          isToday
          tz={tz}
          profile={profile}
          stats={{
            consumed,
            calorieGoal,
            macroGoals,
            bmr,
            active,
            tdee,
            lactationKcal,
            goalType,
            kcalOffset,
            activity: todayActivity,
            latestWeight: latestWeight
              ? { weightKg: latestWeight.weightKg, loggedAt: latestWeight.loggedAt }
              : null,
            delta7dKg,
          }}
          weekSummary={weekSummary}
          mealItems={mealItems}
          mealsCount={meals.length}
          foodCount={foodCount}
          suggestedMealName={autoMealNameInTz(now, tz)}
          friendSummaries={friendSummaries}
        />
      </main>
    </div>
  );
}
