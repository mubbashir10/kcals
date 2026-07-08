import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { metricColor } from "@/lib/metric-colors";
import { DayMealList } from "@/components/day-meal-list";
import { NewMealButton } from "@/components/new-meal-button";
import { DayActivityTile, DayWeightTile } from "@/components/day-editors";
import { db } from "@/lib/db";
import { calculateBmr, type Sex, type Units } from "@/lib/bmr";
import {
  autoMealNameInTz,
  dayKeyInTz,
  formatLongDateInTz,
  startOfDayForDayKey,
} from "@/lib/clock";
import { shiftDayKey } from "@/lib/calendar-build";
import { normalizeMealSort } from "@/lib/widget-order";
import { loadDayMealItems } from "@/lib/default-meals";
import {
  computeEffectiveTarget,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { lactationKcal, lactationFloor } from "@/lib/lactation";
import { computeMacroGoals } from "@/lib/macros";
import {
  activeKcal,
  activeKcalDaily,
  calculateTdee,
  type ActivityMode,
} from "@/lib/tdee";
import { requireProfile } from "@/lib/session";
import { sumBy } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Strict "YYYY-MM-DD". We don't want surprise inputs like "2026-5-1" turning
// into different days under different timezones.
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date: dayKey } = await params;
  if (!DAY_KEY_RE.test(dayKey)) notFound();

  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const units = profile.units as Units;

  // The UTC window that covers this calendar day in the user's tz.
  const dayStart = startOfDayForDayKey(tz, dayKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [meals, activityLog, weightLogs] = await Promise.all([
    db.meal.findMany({
      where: {
        userId,
        loggedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { loggedAt: normalizeMealSort(profile.mealSortDir) },
      include: { foods: { orderBy: { loggedAt: "asc" } } },
    }),
    db.activityLog.findUnique({
      where: { userId_dayKey: { userId, dayKey } },
    }),
    db.weightLog.findMany({
      where: {
        userId,
        loggedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { loggedAt: "asc" },
    }),
  ]);

  const allFoods = meals.flatMap((m) => m.foods);
  const consumed = {
    kcal: sumBy(allFoods, "kcal"),
    protein: sumBy(allFoods, "proteinG"),
    carbs: sumBy(allFoods, "carbsG"),
    fat: sumBy(allFoods, "fatG"),
  };

  // BMR/TDEE: prefer the day's stored snapshot; fall back to the current
  // profile (same compromise as daily-history.ts).
  const fallbackBmr = calculateBmr({
    sex: profile.sex as Sex,
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });
  const fallbackActive = activeKcal({
    weightKg: profile.weightKg,
    mode: profile.activityMode as ActivityMode,
    stepsPerDay: profile.stepsPerDay,
    liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
    liftingMinutesPerSession: profile.liftingMinutesPerSession,
    cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
    cardioMinutesPerSession: profile.cardioMinutesPerSession,
    activeKcalOverride: profile.activeKcalOverride,
  });
  const fallbackTdee = calculateTdee(fallbackBmr.kcal, fallbackActive);

  const bmrKcal = activityLog?.bmrKcal ?? fallbackBmr.kcal;
  // Lactation adds the milk-production cost on top of burned energy (applies
  // forward from the current profile, same as the goal — not snapshotted).
  const tdeeKcal = (activityLog?.tdeeKcal ?? fallbackTdee) + lactationKcal(profile);

  const goalType: GoalType = isGoalType(profile.goalType)
    ? profile.goalType
    : "maintain";
  const goalPace: GoalPace | null = isGoalPace(profile.goalPace)
    ? profile.goalPace
    : null;
  const calorieGoal = computeEffectiveTarget(
    tdeeKcal,
    bmrKcal,
    goalType,
    goalPace,
    profile.trackKcal,
    lactationFloor(profile)
  );
  const macroGoals = computeMacroGoals(calorieGoal, profile);

  // Active kcal for this day specifically (from the snapshot's logged inputs,
  // or fall back to the profile estimate).
  const activeKcalToday = activityLog
    ? activeKcalDaily({
        weightKg: profile.weightKg,
        mode: activityLog.mode as ActivityMode,
        steps: activityLog.steps,
        liftingMin: activityLog.liftingMin,
        cardioMin: activityLog.cardioMin,
        wearableKcal: activityLog.wearableKcal,
      })
    : fallbackActive;

  // Weight: keep the latest logged on this day (loggedAt asc → last wins).
  const dayWeight = weightLogs.at(-1) ?? null;

  const todayKey = dayKeyInTz(tz, new Date());
  const prevKey = shiftDayKey(dayKey, -1);
  const nextKey = shiftDayKey(dayKey, 1);
  const canGoNext = nextKey <= todayKey;
  const isToday = dayKey === todayKey;

  // Real meals + today's default-meal placeholders (past days stay as logged —
  // loadDayMealItems only adds placeholders when dayKey === todayKey).
  const mealItems = await loadDayMealItems({
    userId,
    meals,
    dayKey,
    todayKey,
    tz,
    sortDir: normalizeMealSort(profile.mealSortDir),
  });

  const dateLabel = formatLongDateInTz(dayStart, tz);
  const delta = Math.round(consumed.kcal - calorieGoal);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <div className="flex flex-1 items-center justify-center gap-1">
            <AppLink
              href={`/day/${prevKey}`}
              direction="back"
              aria-label="Previous day"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </AppLink>
            <span className="px-1 text-sm font-semibold tracking-tight">
              {isToday ? "Today" : dateLabel}
            </span>
            {canGoNext ? (
              <AppLink
                href={`/day/${nextKey}`}
                direction="forward"
                aria-label="Next day"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </AppLink>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/30"
              >
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
          <span className="h-8 w-8" aria-hidden />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {/* Calorie hero */}
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Calories
          </h2>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-5xl font-semibold leading-none tabular-nums tracking-tight">
              {Math.round(consumed.kcal).toLocaleString()}
            </div>
            <span className="text-base font-normal text-muted-foreground tabular-nums">
              / {calorieGoal.toLocaleString()} kcal
            </span>
          </div>
          {consumed.kcal > 0 && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              {Math.abs(delta) < 1
                ? "On target"
                : delta > 0
                  ? `+${delta.toLocaleString()} over goal`
                  : `${Math.abs(delta).toLocaleString()} under goal`}
              {" · "}
              <span>
                BMR {Math.round(bmrKcal).toLocaleString()} + Active{" "}
                {Math.round(activeKcalToday.kcal).toLocaleString()} = TDEE{" "}
                {Math.round(tdeeKcal).toLocaleString()}
              </span>
            </p>
          )}
        </section>

        {/* Macros */}
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Macros
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <MacroCard
              label="Protein"
              value={Math.round(consumed.protein)}
              goal={macroGoals.protein}
              color={metricColor.protein}
            />
            <MacroCard
              label="Carbs"
              value={Math.round(consumed.carbs)}
              goal={macroGoals.carbs}
              color={metricColor.carbs}
            />
            <MacroCard
              label="Fat"
              value={Math.round(consumed.fat)}
              goal={macroGoals.fat}
              color={metricColor.fat}
            />
          </div>
        </section>

        {/* Weight & Activity strip */}
        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DayWeightTile
            weightKg={dayWeight?.weightKg ?? null}
            logId={dayWeight?.id ?? null}
            units={units}
            dayKey={dayKey}
          />
          <DayActivityTile
            activity={
              activityLog
                ? {
                    mode: activityLog.mode as ActivityMode,
                    steps: activityLog.steps,
                    liftingMin: activityLog.liftingMin,
                    cardioMin: activityLog.cardioMin,
                    wearableKcal: activityLog.wearableKcal,
                  }
                : null
            }
            defaults={{
              stepsPerDay: profile.stepsPerDay,
              liftingMinutesPerSession: profile.liftingMinutesPerSession,
              cardioMinutesPerSession: profile.cardioMinutesPerSession,
              activeKcalOverride: profile.activeKcalOverride,
            }}
            activeKcal={Math.round(activeKcalToday.kcal)}
            hasActivity={
              activityLog != null &&
              ((activityLog.steps ?? 0) > 0 ||
                (activityLog.liftingMin ?? 0) > 0 ||
                (activityLog.cardioMin ?? 0) > 0 ||
                (activityLog.wearableKcal ?? 0) > 0)
            }
            dayKey={dayKey}
          />
        </section>

        {/* Meals */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Meals
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {meals.length === 0
                ? "none"
                : `${meals.length} ${meals.length === 1 ? "meal" : "meals"} · ${allFoods.length} ${allFoods.length === 1 ? "food" : "foods"}`}
            </span>
          </div>
          {mealItems.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
              <p className="text-sm text-muted-foreground">
                No meals logged this day.
              </p>
            </Card>
          ) : (
            <DayMealList items={mealItems} timezone={tz} />
          )}
          <div className="mt-4 flex justify-center">
            <NewMealButton
              suggestedName={autoMealNameInTz(new Date(), tz)}
              dayKey={dayKey}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

