import { CalendarRange } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { WidgetMenu } from "@/components/widget-menu";
import { displayWeight, type Units } from "@/lib/bmr";
import { netBalanceWord } from "@/lib/week";

// Compact home-dashboard view of the week summary — net deficit/surplus and
// its body-weight equivalent, linking to the full /week page.
export function WeekSummaryWidget({
  loggedDays,
  netKcal,
  predictedWeightKg,
  units,
}: {
  loggedDays: number;
  netKcal: number;
  predictedWeightKg: number;
  units: Units;
}) {
  const hasData = loggedDays > 0;
  const net = Math.round(netKcal);
  const netWord = netBalanceWord(net);
  const weight = displayWeight(Math.abs(predictedWeightKg), units);

  return (
    <Card className="rounded-2xl border-border/60 p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <AppLink
          href="/week"
          aria-label="View week summary"
          className="group inline-flex items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
            This week
          </h2>
        </AppLink>
        <WidgetMenu widgetId="week" label="This week" size="sm" />
      </div>

      {hasData ? (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-3xl font-semibold leading-none tabular-nums tracking-tight">
              {Math.abs(net).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">kcal {netWord}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              ≈{" "}
              <span className="font-medium text-foreground/80">
                {weight.value} {weight.unit}
              </span>
            </span>
          </div>
          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
            {loggedDays} of 7 days logged
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing logged yet this week.
        </p>
      )}
    </Card>
  );
}
