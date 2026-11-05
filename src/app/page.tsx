import { redirect } from "next/navigation";

import { DayDashboard } from "@/components/day-dashboard";
import { IncomingInviteBanner } from "@/components/incoming-invite-banner";
import { BrandHeader } from "@/components/brand-header";
import { UserMenu } from "@/components/user-menu";
import { getWidgetState, normalizeMealSort, parseWidgetStates } from "@/lib/widget-order";
import { listFriendSummaries, pendingInvitesForUser } from "@/lib/friends";
import { getSession } from "@/lib/session";
import { loadDailyStats } from "@/lib/daily-stats";
import { loadWeekSummary } from "@/lib/week";
import { autoMealNameInTz, dayKeyInTz, greetingInTz } from "@/lib/clock";
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
    sourceIcon,
    meals,
    latestWeight,
    delta7dKg,
    consumed,
    foodCount,
    macroGoals,
  } = stats;

  const widgetStates = parseWidgetStates(profile.widgetStates);
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

  const [friendSummaries, incomingInvites, weekSummary] = await Promise.all([
    friendSummariesPromise,
    incomingInvitesPromise,
    loadWeekSummary(userId, profile, null, now),
  ]);

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
        <h1 className="mb-5 font-heading text-4xl font-semibold leading-tight tracking-tight">
          {greetingInTz(tz, now)}.
        </h1>

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
            sourceIcon,
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
