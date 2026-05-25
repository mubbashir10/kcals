"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight, Flame } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CalorieRing, type CalorieDisplayMode } from "@/components/calorie-ring";
import { WidgetMenu } from "@/components/widget-menu";
import { setCalorieDisplay } from "@/app/actions/widgets";
import type { WidgetState } from "@/lib/widget-order";

export function CalorieRingWidget({
  consumed,
  goal,
  initialMode,
  bmrKcal,
  activeKcal,
  state,
}: {
  consumed: number;
  goal: number;
  initialMode: CalorieDisplayMode;
  /** Optional — when both are present, shows a tiny breakdown row below the ring. */
  bmrKcal?: number;
  activeKcal?: number;
  state: Exclude<WidgetState, "hidden">;
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

  if (state === "minimized") {
    const value = mode === "remaining" ? goal - consumed : consumed;
    const label = mode === "remaining" ? "left" : "eaten";
    return (
      <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Flame className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Calories
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-base font-semibold leading-none tabular-nums tracking-tight">
              {Math.round(value).toLocaleString()}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {label}
              </span>
            </div>
            <WidgetMenu
              widgetId="calorie"
              current="minimized"
              label="Calorie ring"
              size="sm"
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative rounded-3xl border-border/60 px-6 py-12 shadow-card-lg">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          mode === "remaining"
            ? "Switch to showing consumed"
            : "Switch to showing remaining"
        }
        className="absolute left-4 top-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeftRight className="h-3 w-3" />
        {mode === "remaining" ? "Remaining" : "Consumed"}
      </button>

      <div className="absolute right-4 top-4">
        <WidgetMenu
          widgetId="calorie"
          current="expanded"
          label="Calorie ring"
        />
      </div>

      <div className="flex flex-col items-center">
        <CalorieRing consumed={consumed} goal={goal} mode={mode} />

        {typeof bmrKcal === "number" && typeof activeKcal === "number" && (
          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
              Total{" "}
              <span className="font-semibold text-foreground">
                {Math.round(bmrKcal + activeKcal).toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
