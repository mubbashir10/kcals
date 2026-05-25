import { ArrowLeftRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { WidgetMenu } from "@/components/widget-menu";
import type { WidgetState } from "@/lib/widget-order";

type Totals = { protein: number; carbs: number; fat: number };
type Goals = { protein: number; carbs: number; fat: number };

export function MacrosWidget({
  consumed,
  goals,
  state,
}: {
  consumed: Totals;
  goals: Goals;
  state: Exclude<WidgetState, "hidden">;
}) {
  if (state === "minimized") {
    return (
      <Card className="rounded-2xl border-border/60 px-5 py-3 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-rose-500" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Macros
            </span>
          </div>
          <div className="flex items-center gap-3">
            <MiniMacro label="P" value={Math.round(consumed.protein)} goal={goals.protein} />
            <MiniMacro label="C" value={Math.round(consumed.carbs)} goal={goals.carbs} />
            <MiniMacro label="F" value={Math.round(consumed.fat)} goal={goals.fat} />
            <WidgetMenu
              widgetId="macros"
              current="minimized"
              label="Macros"
              size="sm"
            />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Macros
        </h2>
        <WidgetMenu
          widgetId="macros"
          current="expanded"
          label="Macros"
          size="sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MacroCard
          label="Protein"
          value={Math.round(consumed.protein)}
          goal={goals.protein}
          accent="oklch(0.68 0.2 20)"
        />
        <MacroCard
          label="Carbs"
          value={Math.round(consumed.carbs)}
          goal={goals.carbs}
          accent="oklch(0.78 0.16 75)"
        />
        <MacroCard
          label="Fat"
          value={Math.round(consumed.fat)}
          goal={goals.fat}
          accent="oklch(0.6 0.18 280)"
        />
      </div>
    </section>
  );
}

function MiniMacro({
  label,
  value,
  goal,
}: {
  label: string;
  value: number;
  goal: number;
}) {
  return (
    <span className="text-[11px] tabular-nums">
      <span className="font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>{" "}
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">/{goal}</span>
    </span>
  );
}
