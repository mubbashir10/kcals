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
import { Card } from "@/components/ui/card";
import { CalorieRing, type CalorieDisplayMode } from "@/components/calorie-ring";
import { WidgetMenu } from "@/components/widget-menu";
import { setCalorieDisplay } from "@/app/actions/widgets";
import type { GoalType } from "@/lib/goal";

const GOAL_CHIP: Record<
  GoalType,
  { label: string; icon: LucideIcon; tone: string }
> = {
  loss: { label: "Lose", icon: TrendingDown, tone: "text-rose-400" },
  maintain: { label: "Maintain", icon: Minus, tone: "text-sky-400" },
  gain: { label: "Gain", icon: TrendingUp, tone: "text-emerald-400" },
  track: { label: "Tracking", icon: Activity, tone: "text-muted-foreground" },
};

export function CalorieRingWidget({
  consumed,
  goal,
  initialMode,
  bmrKcal,
  activeKcal,
  goalType,
  kcalOffset,
}: {
  consumed: number;
  goal: number;
  initialMode: CalorieDisplayMode;
  /** Optional — when both are present, shows a tiny breakdown row below the ring. */
  bmrKcal?: number;
  activeKcal?: number;
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
    <Card className="group relative rounded-3xl border-border/60 px-5 pb-8 pt-4 shadow-card-lg transition-colors hover:bg-accent/20 sm:px-6 sm:pb-10 sm:pt-5">
      <AppLink
        href="/calories"
        aria-label="View calorie history"
        className="absolute inset-0 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {/* The row/ring below sit above the inset-0 link, so they'd swallow its
          clicks. Make the wrappers transparent to pointer events and re-enable
          only the genuine controls, so clicking anywhere else opens /calories. */}
      <div className="pointer-events-none relative flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={
            mode === "remaining"
              ? "Switch to showing consumed"
              : "Switch to showing remaining"
          }
          className="pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftRight className="h-3 w-3" />
          {mode === "remaining" ? "Remaining" : "Consumed"}
        </button>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <GoalChip type={goalType} offset={kcalOffset} />
          <WidgetMenu widgetId="calorie" label="Calorie ring" />
        </div>
      </div>

      <div className="pointer-events-none relative mt-8 flex flex-col items-center sm:mt-10">
        <CalorieRing consumed={consumed} goal={goal} mode={mode} />

        {typeof bmrKcal === "number" && typeof activeKcal === "number" && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="tabular-nums">
              BMR{" "}
              <span className="font-semibold text-foreground/80">
                {Math.round(bmrKcal).toLocaleString()}
              </span>
            </span>
            <span className="text-muted-foreground/40">+</span>
            <span className="tabular-nums">
              Active{" "}
              <span className="font-semibold text-foreground/80">
                {Math.round(activeKcal).toLocaleString()}
              </span>
            </span>
            <span className="text-muted-foreground/40">=</span>
            <span className="tabular-nums">
              TDEE{" "}
              <span className="font-semibold text-foreground/80">
                {Math.round(bmrKcal + activeKcal).toLocaleString()}
              </span>
            </span>
            {kcalOffset !== 0 && (
              <>
                <span className="text-muted-foreground/40">
                  {kcalOffset < 0 ? "−" : "+"}
                </span>
                <span className="tabular-nums">
                  Goal{" "}
                  <span className="font-semibold text-foreground/80">
                    {Math.abs(kcalOffset).toLocaleString()}
                  </span>
                </span>
                <span className="text-muted-foreground/40">=</span>
                <span className="tabular-nums">
                  Target{" "}
                  <span className="font-semibold text-foreground">
                    {goal.toLocaleString()}
                  </span>
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function GoalChip({ type, offset }: { type: GoalType; offset: number }) {
  const meta = GOAL_CHIP[type];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground"
      title={
        offset === 0
          ? meta.label
          : `${meta.label}: ${offset < 0 ? "−" : "+"}${Math.abs(offset)} kcal/day`
      }
    >
      <Icon className={`h-3 w-3 ${meta.tone}`} />
      {meta.label}
    </span>
  );
}
