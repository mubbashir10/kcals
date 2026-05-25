import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Plus,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { ActivityCard } from "@/components/activity-card";
import { CalorieRing } from "@/components/calorie-ring";
import { Logo } from "@/components/logo";
import { MacroCard } from "@/components/macro-card";
import { MealCard } from "@/components/meal-card";
import { NewMealButton } from "@/components/new-meal-button";
import { UserMenu } from "@/components/user-menu";
import { WeightCard } from "@/components/weight-card";
import { db } from "@/lib/db";
import { calculateBmr } from "@/lib/bmr";
import { activeKcal, activeKcalDaily, calculateTdee } from "@/lib/tdee";
import {
  autoMealNameInTz,
  dayKeyInTz,
  formatLongDateInTz,
  greetingInTz,
  startOfDayInTz,
} from "@/lib/clock";

export const dynamic = "force-dynamic";

// Rough macro split goals as % of calories — we'll let users tune these later.
const MACRO_TARGETS = {
  proteinPct: 0.3,
  carbsPct: 0.4,
  fatPct: 0.3,
} as const;
// kcal per gram of each macro
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export default async function Home() {
  const profile = await db.profile.findFirst();
  if (!profile) redirect("/setup");

  const tz = profile.timezone || "UTC";
  const now = new Date();

  const bmr = calculateBmr({
    sex: profile.sex as "male" | "female",
    age: profile.age,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    bodyFatPct: profile.bodyFatPct,
  });

  const todayKey = dayKeyInTz(tz, now);
  const todayActivity = await db.activityLog.findUnique({
    where: { dayKey: todayKey },
  });

  const active = todayActivity
    ? activeKcalDaily({
        weightKg: profile.weightKg,
        mode: todayActivity.mode as "estimate" | "override",
        steps: todayActivity.steps,
        liftingMin: todayActivity.liftingMin,
        cardioMin: todayActivity.cardioMin,
        wearableKcal: todayActivity.wearableKcal,
      })
    : activeKcal({
        weightKg: profile.weightKg,
        mode: profile.activityMode as "estimate" | "override",
        stepsPerDay: profile.stepsPerDay,
        liftingSessionsPerWeek: profile.liftingSessionsPerWeek,
        liftingMinutesPerSession: profile.liftingMinutesPerSession,
        cardioSessionsPerWeek: profile.cardioSessionsPerWeek,
        cardioMinutesPerSession: profile.cardioMinutesPerSession,
        activeKcalOverride: profile.activeKcalOverride,
      });

  const tdee = calculateTdee(bmr.kcal, active);
  const calorieGoal = Math.round(tdee);

  const meals = await db.meal.findMany({
    where: { loggedAt: { gte: startOfDayInTz(tz, now) } },
    orderBy: { loggedAt: "desc" },
    include: {
      foods: { orderBy: { loggedAt: "asc" } },
    },
  });

  // Weight tracking — latest log + the log closest to (≤) 7 days ago for trend
  const latestWeight = await db.weightLog.findFirst({
    orderBy: { loggedAt: "desc" },
  });
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const baselineWeight = latestWeight
    ? await db.weightLog.findFirst({
        where: { loggedAt: { lte: weekAgo } },
        orderBy: { loggedAt: "desc" },
      })
    : null;
  const delta7dKg =
    latestWeight && baselineWeight
      ? latestWeight.weightKg - baselineWeight.weightKg
      : null;

  const allFoods = meals.flatMap((m) => m.foods);
  const consumed = {
    kcal: sum(allFoods, "kcal"),
    protein: sum(allFoods, "proteinG"),
    carbs: sum(allFoods, "carbsG"),
    fat: sum(allFoods, "fatG"),
  };
  const foodCount = allFoods.length;

  const macroGoals = {
    protein: Math.round(
      (calorieGoal * MACRO_TARGETS.proteinPct) / KCAL_PER_G.protein
    ),
    carbs: Math.round(
      (calorieGoal * MACRO_TARGETS.carbsPct) / KCAL_PER_G.carbs
    ),
    fat: Math.round((calorieGoal * MACRO_TARGETS.fatPct) / KCAL_PER_G.fat),
  };

  const dateStr = formatLongDateInTz(now, tz);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.92_0.06_70_/_0.6)_0%,transparent_70%)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.35_0.08_40_/_0.4)_0%,transparent_70%)]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">
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

        <Card className="mb-4 rounded-3xl border-border/60 p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Maintenance calories
            </span>
          </div>
          <div className="mt-3 text-5xl font-semibold leading-none tabular-nums tracking-tight">
            {Math.round(tdee).toLocaleString()}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              kcal/day
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            What you burn on a typical day — eat this to maintain weight.
          </p>

          <div
            className={`mt-5 grid gap-3 border-t border-border/60 pt-4 ${
              active.source === "override" ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            <Breakdown
              icon={Heart}
              accent="text-rose-500/80"
              label="BMR"
              value={Math.round(bmr.kcal)}
              hint={
                bmr.formula === "katch-mcardle"
                  ? "Katch-McArdle"
                  : "Mifflin-St Jeor"
              }
            />
            {active.source === "override" ? (
              <Breakdown
                icon={Watch}
                accent="text-emerald-500/80"
                label="Active"
                value={Math.round(active.kcal)}
                hint="From wearable"
              />
            ) : (
              <>
                <Breakdown
                  icon={Footprints}
                  accent="text-sky-500/80"
                  label="NEAT"
                  value={Math.round(active.fromSteps)}
                  hint={
                    todayActivity?.steps && todayActivity.steps > 0
                      ? `${todayActivity.steps.toLocaleString()} steps today`
                      : profile.stepsPerDay && profile.stepsPerDay > 0
                      ? `${profile.stepsPerDay.toLocaleString()} steps/day avg`
                      : "Log steps for today"
                  }
                />
                <Breakdown
                  icon={Dumbbell}
                  accent="text-amber-500/80"
                  label="EAT"
                  value={Math.round(active.fromLifting + active.fromCardio)}
                  hint={
                    todayActivity
                      ? eatHintForDailyLog(
                          todayActivity.liftingMin,
                          todayActivity.cardioMin
                        )
                      : [
                          active.fromLifting > 0 && "lifting",
                          active.fromCardio > 0 && "cardio",
                        ]
                          .filter(Boolean)
                          .join(" + ") || "Log workout for today"
                  }
                />
              </>
            )}
          </div>
        </Card>

        <div className="mb-4">
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
        </div>

        <div className="mb-4">
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
          />
        </div>

        <Card className="rounded-3xl border-border/60 px-6 py-12 shadow-sm">
          <div className="flex flex-col items-center">
            <CalorieRing
              consumed={Math.round(consumed.kcal)}
              goal={calorieGoal}
            />
          </div>
        </Card>

        <section className="mt-4 grid grid-cols-3 gap-3">
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

        <section className="mt-12">
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

function sum<K extends "kcal" | "proteinG" | "carbsG" | "fatG">(
  meals: { [P in K]: number }[],
  key: K
) {
  return meals.reduce((acc, m) => acc + (m[key] ?? 0), 0);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function Breakdown({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${accent}`} />
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {value.toLocaleString()}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-muted-foreground/70">
        {hint}
      </div>
    </div>
  );
}
