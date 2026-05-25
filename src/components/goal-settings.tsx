"use client";

import { useState, useTransition } from "react";
import { TrendingDown, TrendingUp, Minus, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { setGoal } from "@/app/actions/widgets";
import {
  GOAL_PACES,
  GOAL_TYPES,
  PACE_KCAL_PER_DAY,
  PACE_KG_PER_WEEK,
  type GoalPace,
  type GoalType,
} from "@/lib/goal";
import { cn } from "@/lib/utils";

type Props = {
  initial: { type: GoalType; pace: GoalPace | null };
  unitsLabel: "kg" | "lb";
};

const TYPE_META: Record<
  GoalType,
  { label: string; hint: string; icon: LucideIcon; accent: string }
> = {
  loss: {
    label: "Lose weight",
    hint: "Eat under your TDEE",
    icon: TrendingDown,
    accent: "text-rose-500",
  },
  maintain: {
    label: "Maintain",
    hint: "Eat at your TDEE",
    icon: Minus,
    accent: "text-sky-500",
  },
  gain: {
    label: "Gain weight",
    hint: "Eat above your TDEE",
    icon: TrendingUp,
    accent: "text-emerald-500",
  },
  track: {
    label: "Just track",
    hint: "No goal, log calories only",
    icon: Activity,
    accent: "text-muted-foreground",
  },
};

const KG_TO_LB = 2.2046226218;

export function GoalSettings({ initial, unitsLabel }: Props) {
  const [type, setType] = useState<GoalType>(initial.type);
  const [pace, setPace] = useState<GoalPace | null>(initial.pace);
  const [, startTransition] = useTransition();

  function save(nextType: GoalType, nextPace: GoalPace | null) {
    setType(nextType);
    setPace(nextPace);
    startTransition(async () => {
      await setGoal(nextType, nextPace);
    });
  }

  function onTypeClick(next: GoalType) {
    if (next === type) return;
    // When switching into loss/gain without an existing pace, default to
    // moderate — it's the textbook "sustainable" pace and a sensible
    // starting point the user can dial up or down.
    const nextPace =
      next === "loss" || next === "gain"
        ? pace ?? "moderate"
        : null;
    save(next, nextPace);
  }

  const showPace = type === "loss" || type === "gain";
  const direction = type === "gain" ? "surplus" : "deficit";

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-border/60 p-1.5 shadow-card">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {GOAL_TYPES.map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTypeClick(t)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center transition-all",
                  active
                    ? "bg-foreground text-background"
                    : "text-foreground/70 hover:bg-accent/40 hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "" : meta.accent
                  )}
                />
                <span className="text-[11px] font-medium">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {showPace && (
        <Card className="space-y-2 rounded-2xl border-border/60 p-3 shadow-card">
          <div className="px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Pace
          </div>
          <div className="space-y-1.5">
            {GOAL_PACES.map((p) => {
              const kcal = PACE_KCAL_PER_DAY[p];
              const kg = PACE_KG_PER_WEEK[p];
              const perWeek =
                unitsLabel === "kg"
                  ? `${kg} kg/wk`
                  : `${(kg * KG_TO_LB).toFixed(2)} lb/wk`;
              const active = p === pace;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => save(type, p)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
                    active
                      ? "bg-foreground text-background"
                      : "text-foreground/80 hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <div>
                    <div className="text-sm font-medium capitalize">{p}</div>
                    <div
                      className={cn(
                        "text-[11px]",
                        active ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      ~{perWeek}
                    </div>
                  </div>
                  <div className="text-right tabular-nums">
                    <div className="text-sm font-semibold">
                      {type === "gain" ? "+" : "−"}
                      {kcal}
                    </div>
                    <div
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-[0.16em]",
                        active ? "text-background/70" : "text-muted-foreground"
                      )}
                    >
                      kcal/day
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="px-1 pt-1 text-[11px] text-muted-foreground/80">
            {TYPE_META[type].hint}. Your calorie target adjusts by the chosen{" "}
            {direction}.
          </p>
        </Card>
      )}
    </div>
  );
}
