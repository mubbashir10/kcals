import { Infinity as InfinityIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { MacroGoal } from "@/lib/macros";

type Props = {
  label: string;
  value: number;
  goal: MacroGoal;
  unit?: string;
  accent: string;
};

export function MacroCard({ label, value, goal, unit = "g", accent }: Props) {
  const tracked = goal.kind !== "off";
  const goalG = tracked ? goal.g : null;
  const pct = tracked && goalG && goalG > 0
    ? Math.min((value / goalG) * 100, 100)
    : 0;

  return (
    <Card className="gap-0 rounded-2xl border-border/60 p-3.5 shadow-card transition-colors hover:bg-accent/30 sm:p-5">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
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

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted sm:mt-4">
        {tracked && (
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%`, backgroundColor: accent }}
          />
        )}
      </div>
    </Card>
  );
}
