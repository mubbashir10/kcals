// The shared dashboard body — the hero (week summary + strip + ring + macros +
// energy) plus the reorderable widget stack (maintenance, weight+activity,
// meals, friends). Rendered identically by the home page (today) and the
// /day/[date] page (any past day); only the surrounding page chrome and the
// day's data differ. Everything below reads a `dayKey`, so add/edit/update
// all target the day in view.

import { Plus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityCard } from "@/components/activity-card";
import { DayHero, type WeekSummary } from "@/components/day-hero";
import { FriendsStrip } from "@/components/friends-strip";
import { MaintenanceCard } from "@/components/maintenance-card";
import { DayMealList } from "@/components/day-meal-list";
import { NewMealButton } from "@/components/new-meal-button";
import { SectionWidgetMenu } from "@/components/section-widget-menu";
import { WeightCard } from "@/components/weight-card";
import {
  SortableWidgets,
  type SortableWidgetItem,
} from "@/components/sortable-widgets";
import {
  getWidgetState,
  normalizeMealSort,
  parseWidgetOrder,
  parseWidgetStates,
} from "@/lib/widget-order";
import type { Units, BmrResult } from "@/lib/bmr";
import type { ActivityMode, ActiveResult } from "@/lib/tdee";
import type { GoalType } from "@/lib/goal";
import type { CalorieDisplayMode } from "@/components/calorie-ring";
import type { MacroGoals } from "@/lib/macros";

type DashboardProfile = {
  units: string;
  weekStartDay: number | null;
  stepsPerDay: number | null;
  liftingMinutesPerSession: number | null;
  cardioMinutesPerSession: number | null;
  activeKcalOverride: number | null;
  calorieDisplay: string | null;
  mealSortDir: string | null;
  widgetOrder: string | null;
  widgetStates: string | null;
};

type ActivityRow = {
  mode: string;
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  wearableKcal: number | null;
} | null;

export type DayDashboardStats = {
  consumed: { kcal: number; protein: number; carbs: number; fat: number };
  calorieGoal: number;
  macroGoals: MacroGoals;
  bmr: BmrResult;
  active: ActiveResult;
  tdee: number;
  lactationKcal: number;
  goalType: GoalType;
  kcalOffset: number;
  /** The day's activity row (null when nothing snapshotted/logged). */
  activity: ActivityRow;
  latestWeight: { weightKg: number; loggedAt: Date } | null;
  delta7dKg: number | null;
};

export function DayDashboard({
  dayKey,
  todayKey,
  isToday,
  tz,
  profile,
  stats,
  weekSummary,
  mealItems,
  mealsCount,
  foodCount,
  suggestedMealName,
  friendSummaries,
}: {
  dayKey: string;
  todayKey: string;
  isToday: boolean;
  tz: string;
  profile: DashboardProfile;
  stats: DayDashboardStats;
  weekSummary: WeekSummary | null;
  mealItems: React.ComponentProps<typeof DayMealList>["items"];
  mealsCount: number;
  foodCount: number;
  suggestedMealName: string;
  friendSummaries: React.ComponentProps<typeof FriendsStrip>["friends"];
}) {
  const widgetStates = parseWidgetStates(profile.widgetStates);
  const maintenanceState = getWidgetState(widgetStates, "maintenance");
  const activityState = getWidgetState(widgetStates, "activity");
  const weightState = getWidgetState(widgetStates, "weight");
  const mealsState = getWidgetState(widgetStates, "meals");
  const friendsState = getWidgetState(widgetStates, "friends");

  const { consumed, active, bmr } = stats;
  const units = profile.units as Units;

  return (
    <>
      <div className="mb-4">
        <DayHero
          activeDayKey={dayKey}
          todayKey={todayKey}
          weekStartDay={profile.weekStartDay ?? 1}
          consumed={Math.round(consumed.kcal)}
          goal={stats.calorieGoal}
          activeKcal={active.kcal}
          bmrKcal={bmr.kcal}
          goalType={stats.goalType}
          kcalOffset={stats.kcalOffset}
          initialMode={
            (profile.calorieDisplay as CalorieDisplayMode) ?? "remaining"
          }
          macros={{
            protein: Math.round(consumed.protein),
            carbs: Math.round(consumed.carbs),
            fat: Math.round(consumed.fat),
          }}
          macroGoals={stats.macroGoals}
          weekSummary={weekSummary}
          units={units}
        />
      </div>

      <SortableWidgets
        initialOrder={parseWidgetOrder(profile.widgetOrder)}
        items={([
          maintenanceState !== "hidden" && {
            id: "maintenance" as const,
            node: (
              <MaintenanceCard
                tdee={stats.tdee}
                lactationKcal={stats.lactationKcal}
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
                        neatHint: neatHintFor(
                          stats.activity?.steps ?? null,
                          profile.stepsPerDay
                        ),
                        eatKcal: active.fromLifting + active.fromCardio,
                        eatHint: eatHintFor(stats.activity, active),
                      }
                }
              />
            ),
          },
          // Weight + activity share one row. They move together; if one is
          // hidden the other takes the full width.
          ((): SortableWidgetItem | false => {
            const showWeight = weightState !== "hidden";
            const showActivity = activityState !== "hidden";
            if (!showWeight && !showActivity) return false;
            const weightNode = showWeight ? (
              <WeightCard
                latest={
                  stats.latestWeight
                    ? {
                        weightKg: stats.latestWeight.weightKg,
                        loggedAt: stats.latestWeight.loggedAt.toISOString(),
                      }
                    : null
                }
                delta7dKg={stats.delta7dKg}
                units={units}
                timezone={tz}
              />
            ) : null;
            const activityNode = showActivity ? (
              <ActivityCard
                today={activityOverride(stats.activity)}
                dayKey={isToday ? null : dayKey}
                defaults={{
                  stepsPerDay: profile.stepsPerDay,
                  liftingMinutesPerSession: profile.liftingMinutesPerSession,
                  cardioMinutesPerSession: profile.cardioMinutesPerSession,
                  activeKcalOverride: profile.activeKcalOverride,
                }}
              />
            ) : null;
            return {
              id: "weight",
              node:
                showWeight && showActivity ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {weightNode}
                    {activityNode}
                  </div>
                ) : (
                  weightNode ?? activityNode
                ),
            };
          })(),
          mealsState !== "hidden" && {
            id: "meals" as const,
            node: (
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppLink
                      href="/diary"
                      aria-label="View food diary"
                      className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <h2 className="text-sm font-semibold tracking-tight transition-colors group-hover:text-foreground/80">
                        {isToday ? "Today's meals" : "Meals"}
                      </h2>
                    </AppLink>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {mealsCount === 0
                        ? "nothing yet"
                        : `${mealsCount} ${mealsCount === 1 ? "meal" : "meals"} · ${foodCount} ${foodCount === 1 ? "food" : "foods"}`}
                    </span>
                  </div>
                  <SectionWidgetMenu
                    widgetId="meals"
                    label="Meals"
                    sort={normalizeMealSort(profile.mealSortDir)}
                  />
                </div>

                {mealItems.length === 0 ? (
                  <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-12 text-center shadow-none">
                    <p className="text-sm text-muted-foreground">
                      No meals logged{isToday ? " yet" : " this day"}.
                    </p>
                    <AppLink
                      href={`/add?day=${dayKey}`}
                      className={cn(buttonVariants({ size: "lg" }), "mt-4 rounded-full")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add food
                    </AppLink>
                  </Card>
                ) : (
                  <>
                    <DayMealList items={mealItems} timezone={tz} />
                    <div className="mt-4 flex justify-center">
                      <NewMealButton
                        suggestedName={suggestedMealName}
                        dayKey={dayKey}
                      />
                    </div>
                  </>
                )}
              </section>
            ),
          },
          friendsState !== "hidden" && {
            id: "friends" as const,
            node: <FriendsStrip friends={friendSummaries} />,
          },
        ] as (SortableWidgetItem | false)[]).filter(
          (x): x is SortableWidgetItem => x !== false
        )}
      />
    </>
  );
}

function neatHintFor(steps: number | null, stepsPerDay: number | null): string {
  if (steps && steps > 0) return `${steps.toLocaleString()} steps`;
  if (stepsPerDay && stepsPerDay > 0)
    return `${stepsPerDay.toLocaleString()} steps/day avg`;
  return "No steps logged";
}

function eatHintFor(activity: ActivityRow, active: ActiveResult): string {
  if (activity) {
    const parts: string[] = [];
    if (activity.liftingMin && activity.liftingMin > 0)
      parts.push(`${activity.liftingMin}m lift`);
    if (activity.cardioMin && activity.cardioMin > 0)
      parts.push(`${activity.cardioMin}m cardio`);
    return parts.join(" + ") || "Rest day";
  }
  return (
    [active.fromLifting > 0 && "lifting", active.fromCardio > 0 && "cardio"]
      .filter(Boolean)
      .join(" + ") || "No workout logged"
  );
}

// The activity card only treats the day as "logged" when there's an actual
// override — not just because a snapshot row exists (we lazy-create one for
// TDEE snapshotting). An empty/cleared row uses the profile default instead.
function activityOverride(row: ActivityRow): {
  mode: ActivityMode;
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  wearableKcal: number | null;
} | null {
  if (!row) return null;
  const hasOverride =
    (row.mode === "override" && (row.wearableKcal ?? 0) > 0) ||
    (row.mode === "estimate" &&
      ((row.steps ?? 0) > 0 ||
        (row.liftingMin ?? 0) > 0 ||
        (row.cardioMin ?? 0) > 0));
  if (!hasOverride) return null;
  return {
    mode: row.mode as ActivityMode,
    steps: row.steps,
    liftingMin: row.liftingMin,
    cardioMin: row.cardioMin,
    wearableKcal: row.wearableKcal,
  };
}
