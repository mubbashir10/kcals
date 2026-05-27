import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  Footprints,
  Scale,
  Watch,
  Zap,
} from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { MealCard } from "@/components/meal-card";
import { db } from "@/lib/db";
import { calculateBmr, kgToLb } from "@/lib/bmr";
import {
  dayKeyInTz,
  formatLongDateInTz,
  parseDayKey,
  startOfDayInTz,
} from "@/lib/clock";
import { shiftDayKey } from "@/lib/calendar-build";
import {
  computeEffectiveTarget,
  isGoalPace,
  isGoalType,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { computeMacroGoals } from "@/lib/macros";
import { activeKcal, activeKcalDaily, calculateTdee } from "@/lib/tdee";
import { requireProfile } from "@/lib/session";
import { round1 } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Match the dots in MacrosWidget/CaloriesHistory.
const MACRO_ACCENTS = {
  protein: "oklch(0.68 0.2 20)",
  carbs: "oklch(0.78 0.16 75)",
  fat: "oklch(0.6 0.18 280)",
} as const;

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
  const units = profile.units as "metric" | "imperial";

  // The UTC window that covers this calendar day in the user's tz.
  const dayStart = parseDayKeyAsStartOfDay(dayKey, tz);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [meals, activityLog, weightLogs] = await Promise.all([
    db.meal.findMany({
      where: {
        userId,
        loggedAt: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { loggedAt: "asc" },
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
    kcal: sum(allFoods, "kcal"),
    protein: sum(allFoods, "proteinG"),
    carbs: sum(allFoods, "carbsG"),
    fat: sum(allFoods, "fatG"),
  };

  // BMR/TDEE: prefer the day's stored snapshot; fall back to the current
  // profile (same compromise as daily-history.ts).
  const fallbackBmr = calculateBmr({
    sex: profile.sex as "male" | "female",
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });
  const fallbackActive = activeKcal({
    weightKg: profile.weightKg,
    mode: profile.activityMode as "estimate" | "override",
    stepsPerDay: profile.stepsPerDay,
    liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
    liftingMinutesPerSession: profile.liftingMinutesPerSession,
    cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
    cardioMinutesPerSession: profile.cardioMinutesPerSession,
    activeKcalOverride: profile.activeKcalOverride,
  });
  const fallbackTdee = calculateTdee(fallbackBmr.kcal, fallbackActive);

  const bmrKcal = activityLog?.bmrKcal ?? fallbackBmr.kcal;
  const tdeeKcal = activityLog?.tdeeKcal ?? fallbackTdee;

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
    profile.trackKcal
  );
  const macroGoals = computeMacroGoals(calorieGoal, profile);

  // Active kcal for this day specifically (from the snapshot's logged inputs,
  // or fall back to the profile estimate).
  const activeKcalToday = activityLog
    ? activeKcalDaily({
        weightKg: profile.weightKg,
        mode: activityLog.mode as "estimate" | "override",
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
          <h2 className="mb-3 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Macros
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <MacroCard
              label="Protein"
              value={Math.round(consumed.protein)}
              goal={macroGoals.protein}
              accent={MACRO_ACCENTS.protein}
            />
            <MacroCard
              label="Carbs"
              value={Math.round(consumed.carbs)}
              goal={macroGoals.carbs}
              accent={MACRO_ACCENTS.carbs}
            />
            <MacroCard
              label="Fat"
              value={Math.round(consumed.fat)}
              goal={macroGoals.fat}
              accent={MACRO_ACCENTS.fat}
            />
          </div>
        </section>

        {/* Weight & Activity strip */}
        <section className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <WeightTile weightKg={dayWeight?.weightKg ?? null} units={units} />
          <ActivityTile
            steps={activityLog?.steps ?? null}
            liftingMin={activityLog?.liftingMin ?? null}
            cardioMin={activityLog?.cardioMin ?? null}
            wearableKcal={activityLog?.wearableKcal ?? null}
            activeKcal={Math.round(activeKcalToday.kcal)}
            hasActivity={
              activityLog != null &&
              ((activityLog.steps ?? 0) > 0 ||
                (activityLog.liftingMin ?? 0) > 0 ||
                (activityLog.cardioMin ?? 0) > 0 ||
                (activityLog.wearableKcal ?? 0) > 0)
            }
          />
        </section>

        {/* Meals */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Meals
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {meals.length === 0
                ? "none"
                : `${meals.length} ${meals.length === 1 ? "meal" : "meals"} · ${allFoods.length} ${allFoods.length === 1 ? "food" : "foods"}`}
            </span>
          </div>
          {meals.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
              <p className="text-sm text-muted-foreground">
                No meals logged this day.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {meals.map((m) => (
                <MealCard key={m.id} meal={m} timezone={tz} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function WeightTile({
  weightKg,
  units,
}: {
  weightKg: number | null;
  units: "metric" | "imperial";
}) {
  const display = weightKg != null
    ? units === "imperial"
      ? kgToLb(weightKg)
      : weightKg
    : null;
  const unit = units === "imperial" ? "lb" : "kg";

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Weight
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {display != null ? (
          <>
            {round1(display).toFixed(1)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          </>
        ) : (
          <span className="text-base font-normal text-muted-foreground">
            —
          </span>
        )}
      </div>
      {display == null && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          No weigh-in logged
        </p>
      )}
    </Card>
  );
}

function ActivityTile({
  steps,
  liftingMin,
  cardioMin,
  wearableKcal,
  activeKcal: activeKcalValue,
  hasActivity,
}: {
  steps: number | null;
  liftingMin: number | null;
  cardioMin: number | null;
  wearableKcal: number | null;
  activeKcal: number;
  hasActivity: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Activity
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight">
          {activeKcalValue.toLocaleString()}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          active kcal
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tabular-nums text-muted-foreground">
        {!hasActivity ? (
          <span>Estimated from defaults</span>
        ) : wearableKcal != null && wearableKcal > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Watch className="h-3 w-3" />
            From wearable
          </span>
        ) : (
          <>
            {(steps ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Footprints className="h-3 w-3" />
                {steps!.toLocaleString()} steps
              </span>
            )}
            {(liftingMin ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Dumbbell className="h-3 w-3" />
                {liftingMin}m lift
              </span>
            )}
            {(cardioMin ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3" />
                {cardioMin}m cardio
              </span>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function parseDayKeyAsStartOfDay(dayKey: string, tz: string): Date {
  // Treat the dayKey as a wall-clock date in `tz` and resolve the UTC
  // instant of 00:00 local time. Reuses startOfDayInTz via a reference Date.
  const { year, month, day } = parseDayKey(dayKey);
  // Noon UTC is safely inside the calendar day for almost every IANA tz.
  const ref = new Date(Date.UTC(year, month - 1, day, 12));
  return startOfDayInTz(tz, ref);
}

function sum<K extends "kcal" | "proteinG" | "carbsG" | "fatG">(
  rows: { [P in K]: number }[],
  key: K
) {
  return rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
}

