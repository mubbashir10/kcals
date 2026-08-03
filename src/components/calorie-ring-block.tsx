"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  ArrowLeftRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { CalorieRing, type CalorieDisplayMode } from "@/components/calorie-ring";
import { EqDayBalance } from "@/components/energy-equation";
import { setCalorieDisplay } from "@/app/actions/widgets";
import { cn } from "@/lib/utils";
import type { BurnProjection } from "@/lib/daily-snapshot";
import type { GoalType } from "@/lib/goal";

const GOAL_CHIP: Record<
  GoalType,
  { label: string; icon: LucideIcon; accent: string; bg: string }
> = {
  loss: {
    label: "Lose",
    icon: TrendingDown,
    accent: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  maintain: {
    label: "Maintain",
    icon: Minus,
    accent: "text-sky-500",
    bg: "bg-sky-500/10",
  },
  gain: {
    label: "Gain",
    icon: TrendingUp,
    accent: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  track: {
    label: "Tracking",
    icon: Activity,
    accent: "text-muted-foreground",
    bg: "bg-muted/50",
  },
};

// The calorie ring block: a remaining/consumed toggle + goal chip, then the
// open-arc ring flanked by Eaten / Burned. Card-less — it lives inside the
// day hero (see day-hero.tsx), directly under the week strip.
export function CalorieRingBlock({
  consumed,
  goal,
  initialMode,
  tdeeKcal,
  bmrKcal,
  goalType,
  kcalOffset,
  burnProjection = null,
  lactationKcal = 0,
}: {
  consumed: number;
  goal: number;
  initialMode: CalorieDisplayMode;
  /** Maintenance for the day. The active term is derived from it and BMR so
   *  the printed terms sum to the target exactly. */
  tdeeKcal?: number;
  /** Basal metabolic rate — the resting term in the energy-balance readout. */
  bmrKcal?: number;
  goalType: GoalType;
  /** Signed kcal offset applied to TDEE for the effective target (negative = deficit). */
  kcalOffset: number;
  /** Set while today's burn is still part forecast — see EqDayBalance. */
  burnProjection?: BurnProjection | null;
  /** Milk, already inside `tdeeKcal` — see EqDayBalance. */
  lactationKcal?: number;
}) {
  const [mode, setMode] = useState<CalorieDisplayMode>(initialMode);
  const [, startTransition] = useTransition();

  function toggle() {
    const next: CalorieDisplayMode =
      mode === "remaining" ? "consumed" : "remaining";
    // Optimistic update — feels instant
    setMode(next);
    startTransition(async () => {
      await setCalorieDisplay(next);
    });
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={
            mode === "remaining"
              ? "Switch to showing consumed"
              : "Switch to showing remaining"
          }
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftRight className="h-3 w-3" />
          {mode === "remaining" ? "Remaining" : "Consumed"}
        </button>

        <GoalChip type={goalType} offset={kcalOffset} />
      </div>

      {/* The ring opens the calorie history. */}
      <AppLink
        href="/calories"
        aria-label="View calorie history"
        className="mt-6 flex items-center justify-center rounded-2xl outline-none transition-colors hover:bg-accent/10 focus-visible:ring-2 focus-visible:ring-ring/40 sm:mt-8"
      >
        <CalorieRing consumed={consumed} goal={goal} mode={mode} size={220} />
      </AppLink>

      {/* The ring's number, spelled out as the day's equation. */}
      {typeof bmrKcal === "number" && typeof tdeeKcal === "number" && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-[13px] text-muted-foreground sm:mt-9">
          <EqDayBalance
            bmr={Math.round(bmrKcal)}
            burned={Math.round(tdeeKcal) - Math.round(bmrKcal)}
            eaten={consumed}
            goal={Math.round(goal)}
            burnProjection={burnProjection}
            lactationKcal={lactationKcal}
          />
        </div>
      )}
    </div>
  );
}

function GoalChip({ type, offset }: { type: GoalType; offset: number }) {
  const meta = GOAL_CHIP[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium uppercase tracking-[0.14em]",
        meta.bg,
        meta.accent
      )}
      title={
        offset === 0
          ? meta.label
          : `${meta.label}: ${offset < 0 ? "−" : "+"}${Math.abs(offset)} kcal/day`
      }
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}
