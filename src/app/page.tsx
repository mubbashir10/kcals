import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { ActivityCard } from "@/components/activity-card";
import { CalorieRingWidget } from "@/components/calorie-ring-widget";
import { FriendsStrip } from "@/components/friends-strip";
import { IncomingInviteBanner } from "@/components/incoming-invite-banner";
import { Logo } from "@/components/logo";
import { MacroCard } from "@/components/macro-card";
import { MaintenanceCard } from "@/components/maintenance-card";
import { MealCard } from "@/components/meal-card";
import { NewMealButton } from "@/components/new-meal-button";
import { UserMenu } from "@/components/user-menu";
import { SortableWidgets } from "@/components/sortable-widgets";
import { WeightCard } from "@/components/weight-card";
import type { WidgetState } from "@/app/actions/widgets";
import { parseWidgetOrder } from "@/lib/widget-order";
import { listFriendSummaries, pendingInvitesForUser } from "@/lib/friends";
import { getSession } from "@/lib/session";
import { loadDailyStats } from "@/lib/daily-stats";
import {
  autoMealNameInTz,
  formatLongDateInTz,
  greetingInTz,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/signin");
  const userId = session.user.id;
  const userEmail = session.user.email ?? null;

  const now = new Date();
  const stats = await loadDailyStats(userId, now);
  if (!stats) redirect("/setup");

  const {
    profile,
    tz,
    bmr,
    active,
    tdee,
    calorieGoal,
    todayActivity,
    meals,
    latestWeight,
    delta7dKg,
    consumed,
    foodCount,
    macroGoals,
  } = stats;

  const maintenanceState = normalizeWidgetState(profile.widgetMaintenance);
  const weightState = normalizeWidgetState(profile.widgetWeight);

  const [friendSummaries, incomingInvites] = await Promise.all([
    listFriendSummaries(userId, now),
    userEmail ? pendingInvitesForUser(userEmail) : Promise.resolve([]),
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            {greetingInTz(tz, now)}.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Here's where you stand today.
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

        <SortableWidgets
          initialOrder={parseWidgetOrder(profile.widgetOrder)}
          items={[
            {
              id: "calorie" as const,
              node: (
                <CalorieRingWidget
                  consumed={Math.round(consumed.kcal)}
                  goal={calorieGoal}
                  initialMode={
                    (profile.calorieDisplay as "remaining" | "consumed") ??
                    "remaining"
                  }
                />
              ),
            },
            {
              id: "macros" as const,
              node: (
                <section className="grid grid-cols-3 gap-3">
                  <MacroCard
                    label="Protein"
                    value={Math.round(consumed.protein)}
                    goal={macroGoals.protein}
                    accent="oklch(0.68 0.2 20)"
                  />
                  <MacroCard
                    label="Carbs"
                    value={Math.round(consumed.carbs)}
                    goal={macroGoals.carbs}
                    accent="oklch(0.78 0.16 75)"
                  />
                  <MacroCard
                    label="Fat"
                    value={Math.round(consumed.fat)}
                    goal={macroGoals.fat}
                    accent="oklch(0.6 0.18 280)"
                  />
                </section>
              ),
            },
            ...(maintenanceState !== "hidden"
              ? [
                  {
                    id: "maintenance" as const,
                    node: (
                      <MaintenanceCard
                        tdee={tdee}
                        state={maintenanceState}
                        breakdown={
                          active.source === "override"
                            ? {
                                kind: "override",
                                bmrKcal: bmr.kcal,
                                bmrFormula: bmr.formula,
                                activeKcal: active.kcal,
                                activeHint: "From wearable",
                              }
                            : {
                                kind: "estimate",
                                bmrKcal: bmr.kcal,
                                bmrFormula: bmr.formula,
                                neatKcal: active.fromSteps,
                                neatHint:
                                  todayActivity?.steps && todayActivity.steps > 0
                                    ? `${todayActivity.steps.toLocaleString()} steps today`
                                    : profile.stepsPerDay && profile.stepsPerDay > 0
                                    ? `${profile.stepsPerDay.toLocaleString()} steps/day avg`
                                    : "Log steps for today",
                                eatKcal: active.fromLifting + active.fromCardio,
                                eatHint: todayActivity
                                  ? eatHintForDailyLog(
                                      todayActivity.liftingMin,
                                      todayActivity.cardioMin
                                    )
                                  : [
                                      active.fromLifting > 0 && "lifting",
                                      active.fromCardio > 0 && "cardio",
                                    ]
                                      .filter(Boolean)
                                      .join(" + ") || "Log workout for today",
                              }
                        }
                      />
                    ),
                  },
                ]
              : []),
            {
              id: "activity" as const,
              node: (
                <ActivityCard
                  today={
                    todayActivity
                      ? {
                          mode: todayActivity.mode as "estimate" | "override",
                          steps: todayActivity.steps,
                          liftingMin: todayActivity.liftingMin,
                          cardioMin: todayActivity.cardioMin,
                          wearableKcal: todayActivity.wearableKcal,
                        }
                      : null
                  }
                  defaults={{
                    stepsPerDay: profile.stepsPerDay,
                    liftingMinutesPerSession: profile.liftingMinutesPerSession,
                    cardioMinutesPerSession: profile.cardioMinutesPerSession,
                    activeKcalOverride: profile.activeKcalOverride,
                  }}
                />
              ),
            },
            ...(weightState !== "hidden"
              ? [
                  {
                    id: "weight" as const,
                    node: (
                      <WeightCard
                        latest={
                          latestWeight
                            ? {
                                weightKg: latestWeight.weightKg,
                                loggedAt: latestWeight.loggedAt.toISOString(),
                              }
                            : null
                        }
                        delta7dKg={delta7dKg}
                        units={profile.units as "metric" | "imperial"}
                        timezone={tz}
                        state={weightState}
                      />
                    ),
                  },
                ]
              : []),
            {
              id: "meals" as const,
              node: (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-tight">
                      Today's meals
                    </h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {meals.length === 0
                        ? "nothing yet"
                        : `${meals.length} ${meals.length === 1 ? "meal" : "meals"} · ${foodCount} ${foodCount === 1 ? "food" : "foods"}`}
                    </span>
                  </div>

                  {meals.length === 0 ? (
                    <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
                      <p className="text-sm text-muted-foreground">
                        No meals logged yet.
                      </p>
                      <Link
                        href="/add"
                        className="mt-4 inline-flex h-9 items-center justify-center gap-1 rounded-full bg-foreground px-5 text-xs font-medium text-background transition-opacity hover:opacity-90"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add food
                      </Link>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {meals.map((m) => (
                        <MealCard key={m.id} meal={m} timezone={tz} />
                      ))}
                    </div>
                  )}
                </section>
              ),
            },
            {
              id: "friends" as const,
              node: <FriendsStrip friends={friendSummaries} />,
            },
          ]}
        />

        {meals.length > 0 && (
          <div className="mt-12 flex justify-center">
            <NewMealButton suggestedName={autoMealNameInTz(now, tz)} />
          </div>
        )}
      </main>
    </div>
  );
}

function eatHintForDailyLog(
  liftingMin: number | null,
  cardioMin: number | null
): string {
  const parts: string[] = [];
  if (liftingMin && liftingMin > 0) parts.push(`${liftingMin}m lift`);
  if (cardioMin && cardioMin > 0) parts.push(`${cardioMin}m cardio`);
  return parts.join(" + ") || "Rest day";
}

function normalizeWidgetState(
  raw: string | null | undefined
): Exclude<WidgetState, never> {
  if (raw === "minimized" || raw === "hidden") return raw;
  return "expanded";
}
