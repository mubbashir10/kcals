"use client";

import { useTransition } from "react";
import {
  ArrowLeftRight,
  Circle,
  Eye,
  EyeOff,
  Flame,
  Maximize2,
  Minimize2,
  Scale,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  setCalorieDisplay,
  setWidgetState,
  type CalorieDisplayMode,
  type WidgetId,
  type WidgetState,
} from "@/app/actions/widgets";

type WidgetSettings = {
  maintenance: WidgetState;
  weight: WidgetState;
  calorieDisplay: CalorieDisplayMode;
};

const STATES: { value: WidgetState; label: string; icon: typeof Eye }[] = [
  { value: "expanded", label: "Expanded", icon: Maximize2 },
  { value: "minimized", label: "Minimized", icon: Minimize2 },
  { value: "hidden", label: "Hidden", icon: EyeOff },
];

const CALORIE_MODES: {
  value: CalorieDisplayMode;
  label: string;
}[] = [
  { value: "remaining", label: "Remaining" },
  { value: "consumed", label: "Consumed" },
];

export function WidgetsSettings({ initial }: { initial: WidgetSettings }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Choose how each widget appears on your home dashboard.
      </p>

      <CalorieDisplayRow current={initial.calorieDisplay} />

      <WidgetRow
        id="maintenance"
        label="Maintenance calories"
        icon={Flame}
        accent="text-amber-500"
        current={initial.maintenance}
      />
      <WidgetRow
        id="weight"
        label="Weight"
        icon={Scale}
        accent="text-muted-foreground"
        current={initial.weight}
      />
    </div>
  );
}

function CalorieDisplayRow({ current }: { current: CalorieDisplayMode }) {
  const [pending, startTransition] = useTransition();

  function set(next: CalorieDisplayMode) {
    if (next === current) return;
    startTransition(async () => {
      await setCalorieDisplay(next);
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Circle className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-sm font-medium">Calorie ring</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          Show
        </span>
      </div>
      <div
        className={cn(
          "inline-flex w-full rounded-full bg-muted p-1",
          pending && "opacity-60"
        )}
      >
        {CALORIE_MODES.map(({ value, label }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => set(value)}
              disabled={pending}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && <ArrowLeftRight className="h-3 w-3" />}
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function WidgetRow({
  id,
  label,
  icon: Icon,
  accent,
  current,
}: {
  id: WidgetId;
  label: string;
  icon: typeof Eye;
  accent: string;
  current: WidgetState;
}) {
  const [pending, startTransition] = useTransition();

  function set(next: WidgetState) {
    if (next === current) return;
    startTransition(async () => {
      await setWidgetState(id, next);
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", accent)} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div
        className={cn(
          "inline-flex w-full rounded-full bg-muted p-1",
          pending && "opacity-60"
        )}
      >
        {STATES.map(({ value, label: stateLabel, icon: StateIcon }) => {
          const active = current === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => set(value)}
              disabled={pending}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <StateIcon className="h-3 w-3" />
              {stateLabel}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
