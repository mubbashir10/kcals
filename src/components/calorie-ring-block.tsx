"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  ArrowLeftRight,
  Flame,
  HeartPulse,
  Minus,
  Sigma,
  TrendingDown,
  TrendingUp,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { CalorieRing, type CalorieDisplayMode } from "@/components/calorie-ring";
import { cn } from "@/lib/utils";
import { setCalorieDisplay } from "@/app/actions/widgets";
import type { GoalType } from "@/lib/goal";

const GOAL_CHIP: Record<GoalType, { label: string; icon: LucideIcon }> = {
  loss: { label: "Lose", icon: TrendingDown },
  maintain: { label: "Maintain", icon: Minus },
  gain: { label: "Gain", icon: TrendingUp },
  track: { label: "Tracking", icon: Activity },
};

// The calorie ring block: a remaining/consumed toggle + goal chip, then the
// open-arc ring flanked by Eaten / Burned. Card-less — it lives inside the
// day hero (see day-hero.tsx), directly under the week strip.
export function CalorieRingBlock({
  consumed,
  goal,
  initialMode,
  activeKcal,
  bmrKcal,
  goalType,
  kcalOffset,
}: {
  consumed: number;
  goal: number;
  initialMode: CalorieDisplayMode;
  /** Active (exercise/NEAT) kcal — shown as the "Burned" flank next to the ring. */
  activeKcal?: number;
  /** Basal metabolic rate — the resting term in the energy-balance readout. */
  bmrKcal?: number;
  goalType: GoalType;
  /** Signed kcal offset applied to TDEE for the effective target (negative = deficit). */
  kcalOffset: number;
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

      {typeof bmrKcal === "number" && typeof activeKcal === "number" && (
        <EnergyBalance
          bmr={Math.round(bmrKcal)}
          burned={Math.round(activeKcal)}
          eaten={consumed}
        />
      )}
    </div>
  );
}

// The energy equation at a glance: BMR + Burned − Eaten = Net. Net is the raw
// balance (what's left of your burn after eating), independent of the goal.
function EnergyBalance({
  bmr,
  burned,
  eaten,
}: {
  bmr: number;
  burned: number;
  eaten: number;
}) {
  const net = bmr + burned - eaten;
  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-[13px] text-muted-foreground sm:mt-9">
      {/* Burned/Eaten aren't labelled — the flame/fork icons carry them, which
          keeps the line to BMR … = Net on one row. */}
      <Term icon={HeartPulse} value={bmr} label="BMR" />
      <Op>+</Op>
      <Term icon={Flame} value={burned} />
      <Op>−</Op>
      <Term icon={Utensils} value={eaten} />
      {/* net = burn − eaten. Positive = calories still in the bank; negative =
          you out-ate your burn, flagged in the destructive tone rather than
          with a sign. Dead even just reads "0". The `=` rides along with the
          result so it never dangles at the end of a wrapped line. */}
      <span className="inline-flex items-center gap-2.5">
        <Op>=</Op>
        <Term
          icon={Sigma}
          value={Math.abs(net)}
          label={net > 0 ? "remaining" : net < 0 ? "overconsumed" : undefined}
          strong
          danger={net < 0}
        />
      </span>
    </div>
  );
}

function Term({
  icon: Icon,
  value,
  label,
  strong = false,
  danger = false,
}: {
  icon: LucideIcon;
  value: number;
  label?: string;
  strong?: boolean;
  /** Over-budget — paint the icon + number in the destructive tone. */
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          danger ? "text-destructive" : "text-muted-foreground/70"
        )}
        strokeWidth={2}
      />
      <span
        className={cn(
          "tabular-nums",
          danger
            ? "font-semibold text-destructive"
            : strong
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/70"
        )}
      >
        {value.toLocaleString()}
      </span>
      {label && <span className="text-muted-foreground/70">{label}</span>}
    </span>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground/40">{children}</span>;
}

function GoalChip({ type, offset }: { type: GoalType; offset: number }) {
  const meta = GOAL_CHIP[type];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
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
