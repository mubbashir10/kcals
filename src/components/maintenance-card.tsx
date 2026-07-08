import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Watch,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";
import { cn } from "@/lib/utils";
import type { BmrFormula } from "@/lib/bmr";

type Breakdown =
  | {
      kind: "estimate";
      bmrKcal: number;
      bmrFormula: BmrFormula;
      neatKcal: number;
      neatHint: string;
      eatKcal: number;
      eatHint: string;
    }
  | {
      kind: "override";
      bmrKcal: number;
      bmrFormula: BmrFormula;
      activeKcal: number;
      activeHint: string;
    };

export function MaintenanceCard({
  tdee,
  breakdown,
  lactationKcal = 0,
}: {
  tdee: number;
  breakdown: Breakdown;
  /** Energy cost of making milk, already included in `tdee`. When > 0 we
   *  surface it as its own line so the breakdown still adds up. */
  lactationKcal?: number;
}) {
  return (
    <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Maintenance calories
          </span>
        </div>
        <WidgetMenu widgetId="maintenance" label="Maintenance" />
      </div>
      <div className="mt-3 text-5xl font-semibold leading-none tabular-nums tracking-tight">
        {Math.round(tdee).toLocaleString()}
        <span className="ml-2 text-base font-normal text-muted-foreground">
          kcal/day
        </span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {lactationKcal > 0
          ? "What you burn plus the energy to make milk — eat this to maintain weight while nursing."
          : "What you burn on a typical day — eat this to maintain weight."}
      </p>

      <div
        className={cn(
          "mt-5 grid gap-3 border-t border-border/60 pt-4",
          breakdown.kind === "override" ? "grid-cols-2" : "grid-cols-3"
        )}
      >
        <BreakdownItem
          icon={Heart}
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
            label="Active"
            value={breakdown.activeKcal}
            hint={breakdown.activeHint}
          />
        ) : (
          <>
            <BreakdownItem
              icon={Footprints}
              label="NEAT"
              value={breakdown.neatKcal}
              hint={breakdown.neatHint}
            />
            <BreakdownItem
              icon={Dumbbell}
              label="EAT"
              value={breakdown.eatKcal}
              hint={breakdown.eatHint}
            />
          </>
        )}
      </div>

      {lactationKcal > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-2.5">
          <Baby className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Breastfeeding
          </span>
          <span className="ml-auto text-sm font-semibold tabular-nums">
            +{Math.round(lactationKcal).toLocaleString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              kcal
            </span>
          </span>
        </div>
      )}
    </Card>
  );
}

function BreakdownItem({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {Math.round(value).toLocaleString()}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          kcal
        </span>
      </div>
      <div className="mt-1.5 truncate text-[11px] text-muted-foreground/70">
        {hint}
      </div>
    </div>
  );
}

