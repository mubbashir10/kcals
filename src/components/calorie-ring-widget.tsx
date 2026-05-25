"use client";

import { useState, useTransition } from "react";
import { ArrowLeftRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { CalorieRing, type CalorieDisplayMode } from "@/components/calorie-ring";
import {
  setCalorieDisplay,
} from "@/app/actions/widgets";

export function CalorieRingWidget({
  consumed,
  goal,
  initialMode,
}: {
  consumed: number;
  goal: number;
  initialMode: CalorieDisplayMode;
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
    <Card className="relative rounded-3xl border-border/60 px-6 py-12 shadow-card-lg">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          mode === "remaining"
            ? "Switch to showing consumed"
            : "Switch to showing remaining"
        }
        className="absolute right-4 top-4 inline-flex h-7 items-center gap-1.5 rounded-full bg-muted/50 px-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <ArrowLeftRight className="h-3 w-3" />
        {mode === "remaining" ? "Remaining" : "Consumed"}
      </button>

      <div className="flex flex-col items-center">
        <CalorieRing consumed={consumed} goal={goal} mode={mode} />
      </div>
    </Card>
  );
}
