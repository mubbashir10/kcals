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
      <span className="truncate text-xs font-medium" style={{ color }}>
        {label}
      </span>

      <div className="mt-1.5 flex items-baseline gap-1 leading-none">
        <span className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
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

      {tracked && (
        <Progress
          value={pct}
          indicatorColor={color}
          className="mt-3 [&_[data-slot=progress-track]]:h-1.5"
        />
      )}
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
