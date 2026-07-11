"use client";

import { useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  Circle,
  Eye,
  EyeOff,
  Flame,
  UtensilsCrossed,
  Users,
  Weight,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setCalorieDisplay, setWidgetState } from "@/app/actions/widgets";
import type {
  CalorieDisplayMode,
  WidgetId,
  WidgetState,
} from "@/lib/widget-order";

const STATES: {
  value: WidgetState;
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "shown", label: "Shown", icon: Eye },
  { value: "hidden", label: "Hidden", icon: EyeOff },
];

const CALORIE_MODES: {
  value: CalorieDisplayMode;
  label: string;
}[] = [
  { value: "remaining", label: "Remaining" },
  { value: "consumed", label: "Consumed" },
];

// Every widget the user can customize from settings. Order here is the
// display order in the settings page (not the home dashboard).
const WIDGETS: {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  { id: "maintenance", label: "Maintenance calories", icon: Flame, accent: "text-amber-500" },
  { id: "activity", label: "Today's activity", icon: Activity, accent: "text-sky-500" },
  { id: "weight", label: "Weight", icon: Weight, accent: "text-violet-500" },
  { id: "meals", label: "Today's meals", icon: UtensilsCrossed, accent: "text-orange-500" },
  { id: "friends", label: "Friends", icon: Users, accent: "text-fuchsia-500" },
];

type WidgetsSettingsProps = {
  states: Partial<Record<WidgetId, WidgetState>>;
  calorieDisplay: CalorieDisplayMode;
};

export function WidgetsSettings({ initial }: { initial: WidgetsSettingsProps }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Choose how each widget appears on your home dashboard.
      </p>

      <Card className="divide-y divide-border/60 rounded-2xl border-border/60 p-4 shadow-card">
        <CalorieDisplayCard current={initial.calorieDisplay} />

        {WIDGETS.map((w) => (
          <WidgetRow
            key={w.id}
            id={w.id}
            label={w.label}
            icon={w.icon}
            accent={w.accent}
            current={initial.states[w.id] ?? "shown"}
          />
        ))}
      </Card>
    </div>
  );
}

// The calorie ring is a fixed hero (not a hideable widget), but its
// remaining/consumed default still lives here.
function CalorieDisplayCard({ current }: { current: CalorieDisplayMode }) {
  const [pending, startTransition] = useTransition();

  function set(next: CalorieDisplayMode) {
    if (next === current) return;
    startTransition(async () => {
      await setCalorieDisplay(next);
    });
  }

  return (
    <div className="pb-4">
      <div className="mb-3 flex items-center gap-2">
        <Circle className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-sm font-medium">Calorie ring</span>
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
    </div>
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
  icon: LucideIcon;
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
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] sm:items-center">
      <div className="flex items-center gap-2">
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
    </div>
  );
}
