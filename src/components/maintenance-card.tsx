import type { LucideIcon } from "lucide-react";
import {
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Watch,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";
import { cn } from "@/lib/utils";
import type { WidgetState } from "@/lib/widget-order";

type Breakdown =
  | {
      kind: "estimate";
      bmrKcal: number;
      bmrFormula: "katch-mcardle" | "mifflin-st-jeor";
      neatKcal: number;
      neatHint: string;
      eatKcal: number;
      eatHint: string;
    }
  | {
      kind: "override";
      bmrKcal: number;
      bmrFormula: "katch-mcardle" | "mifflin-st-jeor";
      activeKcal: number;
      activeHint: string;
    };

export function MaintenanceCard({
  tdee,
  state,
  breakdown,
}: {
  tdee: number;
  state: Exclude<WidgetState, "hidden">;
  breakdown: Breakdown;
}) {
  if (state === "minimized") {
    return <MinimizedView tdee={tdee} />;
  }
  return <ExpandedView tdee={tdee} breakdown={breakdown} />;
}

function MinimizedView({ tdee }: { tdee: number }) {
  return (
    <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Flame className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Maintenance
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-base font-semibold leading-none tabular-nums tracking-tight">
            {Math.round(tdee).toLocaleString()}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">
              kcal/day
            </span>
          </div>
          <WidgetMenu
            widgetId="maintenance"
            current="minimized"
            label="Maintenance"
            size="sm"
          />
        </div>
      </div>
    </Card>
  );
}

function ExpandedView({
  tdee,
  breakdown,
}: {
  tdee: number;
  breakdown: Breakdown;
}) {
  return (
    <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Maintenance calories
          </span>
        </div>
        <WidgetMenu
          widgetId="maintenance"
          current="expanded"
          label="Maintenance"
        />
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
        className={cn(
          "mt-5 grid gap-3 border-t border-border/60 pt-4",
          breakdown.kind === "override" ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        <BreakdownItem
          icon={Heart}
          accent="text-rose-500/80"
          label="BMR"
          value={breakdown.bmrKcal}
          hint={
            breakdown.bmrFormula === "katch-mcardle"
              ? "Katch-McArdle"
              : "Mifflin-St Jeor"
          }
        />
        {breakdown.kind === "override" ? (
          <BreakdownItem
            icon={Watch}
            accent="text-emerald-500/80"
            label="Active"
            value={breakdown.activeKcal}
            hint={breakdown.activeHint}
          />
        ) : (
          <>
            <BreakdownItem
              icon={Footprints}
              accent="text-sky-500/80"
              label="NEAT"
              value={breakdown.neatKcal}
              hint={breakdown.neatHint}
            />
            <BreakdownItem
              icon={Dumbbell}
              accent="text-amber-500/80"
              label="EAT"
              value={breakdown.eatKcal}
              hint={breakdown.eatHint}
            />
          </>
        )}
      </div>
    </Card>
  );
}

function BreakdownItem({
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
        <Icon className={cn("h-3 w-3", accent)} />
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {Math.round(value).toLocaleString()}
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

