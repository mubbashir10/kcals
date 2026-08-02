import { Infinity as InfinityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { MacroGoal } from "@/lib/macros";
import { percentOfGoal } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  goal: MacroGoal;
  unit?: string;
  color: string;
  /** Drop the card chrome — renders inline, for use inside another board. */
  flat?: boolean;
};

export function MacroCard({ label, value, goal, unit = "g", color, flat = false }: Props) {
  const tracked = goal.kind !== "off";
  const goalG = tracked ? goal.g : null;
  const pct = percentOfGoal(value, goalG);

  const inner = (
    <>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>

      <div className="mt-2 flex items-baseline gap-1 leading-none sm:mt-3">
        <span className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {value}
        </span>
        {tracked ? (
          <span className="text-[11px] tabular-nums text-muted-foreground/80">
            /{goalG}
            {unit}
          </span>
        ) : (
          <span
            className="inline-flex items-center text-[11px] text-muted-foreground/60"
            title="Not tracked"
          >
            <span className="mr-0.5">/</span>
            <InfinityIcon className="h-3 w-3" aria-label="not tracked" />
          </span>
        )}
      </div>

      <Progress
        value={pct}
        indicatorColor={color}
        className="mt-3 sm:mt-4"
      />
    </>
  );

  if (flat) {
    return <div className="flex flex-col">{inner}</div>;
  }

  return (
    <Card className="gap-0 rounded-2xl border-border/60 p-3.5 shadow-card transition-colors hover:bg-accent/30 sm:p-5">
      {inner}
    </Card>
  );
}
