import { Infinity as InfinityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { WidgetMenu } from "@/components/widget-menu";
import { cn } from "@/lib/utils";
import type { MacroGoal, MacroGoals } from "@/lib/macros";
import type { WidgetState } from "@/lib/widget-order";

// Match the dots inside MacroCard. Single source so minimized + expanded
// agree visually.
const ACCENTS = {
  protein: "oklch(0.68 0.2 20)",
  carbs: "oklch(0.78 0.16 75)",
  fat: "oklch(0.6 0.18 280)",
} as const;

type Totals = { protein: number; carbs: number; fat: number };

export function MacrosWidget({
  consumed,
  goals,
  state,
}: {
  consumed: Totals;
  goals: MacroGoals;
  state: Exclude<WidgetState, "hidden">;
}) {
  if (state === "minimized") {
    return (
      <Card className="rounded-2xl border-border/60 px-4 py-3 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Macros
          </span>
          <WidgetMenu
            widgetId="macros"
            current="minimized"
            label="Macros"
            size="sm"
          />
        </div>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <MiniMacro
            label="P"
            accent={ACCENTS.protein}
            value={Math.round(consumed.protein)}
            goal={goals.protein}
          />
          <MiniMacro
            label="C"
            accent={ACCENTS.carbs}
            value={Math.round(consumed.carbs)}
            goal={goals.carbs}
          />
          <MiniMacro
            label="F"
            accent={ACCENTS.fat}
            value={Math.round(consumed.fat)}
            goal={goals.fat}
          />
        </div>
      </Card>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
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
          accent={ACCENTS.protein}
        />
        <MacroCard
          label="Carbs"
          value={Math.round(consumed.carbs)}
          goal={goals.carbs}
          accent={ACCENTS.carbs}
        />
        <MacroCard
          label="Fat"
          value={Math.round(consumed.fat)}
          goal={goals.fat}
          accent={ACCENTS.fat}
        />
      </div>
    </section>
  );
}

function MiniMacro({
  label,
  accent,
  value,
  goal,
}: {
  label: string;
  accent: string;
  value: number;
  goal: MacroGoal;
}) {
  const tracked = goal.kind !== "off";
  return (
    <span className="flex items-center gap-1.5 text-[11px] tabular-nums">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span
        className={cn(
          "font-medium uppercase tracking-[0.14em] text-muted-foreground"
        )}
      >
        {label}
      </span>
      <span className="font-semibold">{value}</span>
      {tracked ? (
        <span className="text-muted-foreground/70">/{goal.g}</span>
      ) : (
        <span
          className="inline-flex items-center text-muted-foreground/60"
          title="Not tracked"
        >
          /<InfinityIcon className="ml-0.5 h-3 w-3" aria-label="not tracked" />
        </span>
      )}
    </span>
  );
}
