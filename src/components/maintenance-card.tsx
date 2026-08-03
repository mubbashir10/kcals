import type { LucideIcon } from "lucide-react";
import {
  Baby,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  TrendingUp,
  Watch,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { MetricBadge } from "@/components/metric-badge";
import { WidgetMenu } from "@/components/widget-menu";
import { cn } from "@/lib/utils";
import { metricColor } from "@/lib/metric-colors";
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
    }
  // Today, mid-day: part of `activeKcal` hasn't been burned yet. It can't be
  // split into NEAT and EAT the way an estimate can, because the part still to
  // come hasn't chosen yet which it will be.
  | {
      kind: "projected";
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
  const projected = breakdown.kind === "projected";
  return (
    <Card className="rounded-3xl border-border/60 p-6 shadow-card-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MetricBadge icon={Flame} color={metricColor.energy} />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Maintenance calories
          </span>
        </div>
        <WidgetMenu widgetId="maintenance" label="Maintenance" />
      </div>
      <div className="mt-3 text-5xl font-semibold leading-none tabular-nums tracking-tight">
        {projected && "~"}
        {Math.round(tdee).toLocaleString()}
        <span className="ml-2 text-base font-normal text-muted-foreground">
          kcal/day
        </span>
      </div>
      {/* Composed, not branched: a nursing mother looking at today needs both
          halves of this, and picking one would drop the milk line that the
          breakdown below still shows. */}
      <p className="mt-3 text-xs text-muted-foreground">
        {projected
          ? "What today is on course to cost — part measured, part your typical day. It settles as the day does."
          : "What you burn on a typical day — eat this to maintain weight."}
        {lactationKcal > 0 &&
          " The energy to make milk is included, so eating this holds your weight while nursing."}
      </p>

      <div
        className={cn(
          "mt-5 grid gap-3 border-t border-border/60 pt-4",
          breakdown.kind === "estimate" ? "grid-cols-3" : "grid-cols-2"
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
        {breakdown.kind !== "estimate" ? (
          <BreakdownItem
            icon={projected ? TrendingUp : Watch}
            label={projected ? "Active est." : "Active"}
            value={breakdown.activeKcal}
            hint={breakdown.activeHint}
            projected={projected}
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
  projected = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  projected?: boolean;
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
        {projected && "~"}
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

