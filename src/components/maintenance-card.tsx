import type { LucideIcon } from "lucide-react";
import { Baby, Dumbbell, Flame, Footprints, Heart, Watch } from "lucide-react";

import { StatFigure } from "@/components/stat-figure";
import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";
import { cn } from "@/lib/utils";
import { metricColor } from "@/lib/metric-colors";
import type { BmrFormula } from "@/lib/bmr";

// A supplied total is one number and stays one number — only movement we
// worked out ourselves can be split into NEAT and EAT.
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
      kind: "direct";
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
    <Card className="gap-0 rounded-3xl border-border/60 p-5 shadow-card-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 shrink-0" style={{ color: metricColor.energy }} />
          <span className="text-xs font-medium text-muted-foreground">
            Maintenance calories
          </span>
        </div>
        <WidgetMenu widgetId="maintenance" label="Maintenance" />
      </div>
      <StatFigure
        size="4xl"
        value={Math.round(tdee).toLocaleString()}
        unit="kcal/day"
        className="mt-3"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        What this day costs you. Eat this to hold your weight.
        {lactationKcal > 0 &&
          " The energy to make milk is included, so eating this holds your weight while nursing."}
      </p>

      <div
        className={cn(
          "mt-4 grid gap-3 border-t border-border/60 pt-4",
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
        {breakdown.kind === "direct" ? (
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
        <div className="text-xs font-medium text-muted-foreground">
          {label}
        </div>
      </div>
      <StatFigure
        size="xl"
        value={Math.round(value).toLocaleString()}
        unit="kcal"
        className="mt-1.5"
      />
      <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}

