"use client";

import { useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  CalendarDays,
  Circle,
  EyeOff,
  Flame,
  Maximize2,
  Minimize2,
  Scale,
  UtensilsCrossed,
  Users,
  Zap,
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

// Every widget the user can customize from settings. Order here is the
// display order in the settings page (not the home dashboard).
const WIDGETS: {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  accent: string;
}[] = [
  { id: "calorie", label: "Calorie ring", icon: Circle, accent: "text-emerald-500" },
  { id: "macros", label: "Macros", icon: ArrowLeftRight, accent: "text-rose-500" },
  { id: "maintenance", label: "Maintenance calories", icon: Flame, accent: "text-amber-500" },
  { id: "activity", label: "Today's activity", icon: Zap, accent: "text-sky-500" },
  { id: "weight", label: "Weight", icon: Scale, accent: "text-violet-500" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, accent: "text-emerald-500" },
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

      {WIDGETS.map((w) => (
        <WidgetRow
          key={w.id}
          id={w.id}
          label={w.label}
          icon={w.icon}
          accent={w.accent}
          current={initial.states[w.id] ?? "expanded"}
          extra={
            w.id === "calorie" ? (
              <CalorieDisplayToggle current={initial.calorieDisplay} />
            ) : null
          }
        />
      ))}
    </div>
  );
}

function CalorieDisplayToggle({ current }: { current: CalorieDisplayMode }) {
  const [pending, startTransition] = useTransition();

  function set(next: CalorieDisplayMode) {
    if (next === current) return;
    startTransition(async () => {
      await setCalorieDisplay(next);
    });
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Display
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
    </div>
  );
}

function WidgetRow({
  id,
  label,
  icon: Icon,
  accent,
  current,
  extra,
}: {
  id: WidgetId;
  label: string;
  icon: LucideIcon;
  accent: string;
  current: WidgetState;
  extra?: React.ReactNode;
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
      {extra}
    </Card>
  );
}
