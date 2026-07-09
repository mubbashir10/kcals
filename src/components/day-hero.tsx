// The dashboard's hero: one card, three bands. A tinted app-bar header carries
// the week summary and the day strip; the calorie ring sits in the body; the
// macros run along the foot. Server component — only the ring's
// remaining/consumed toggle is a nested client island.

import { ArrowUpRight, CalendarDays } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { WeekStrip } from "@/components/week-strip";
import { CalorieRingBlock } from "@/components/calorie-ring-block";
import type { CalorieDisplayMode } from "@/components/calorie-ring";
import { metricColor } from "@/lib/metric-colors";
import { displayWeight, type Units } from "@/lib/bmr";
import { netBalanceWord } from "@/lib/week";
import type { GoalType } from "@/lib/goal";
import type { MacroGoals } from "@/lib/macros";

export type WeekSummary = {
  loggedDays: number;
  netKcal: number;
  predictedWeightKg: number;
};

export function DayHero({
  activeDayKey,
  todayKey,
  weekStartDay,
  consumed,
  goal,
  activeKcal,
  bmrKcal,
  goalType,
  kcalOffset,
  initialMode,
  macros,
  macroGoals,
  weekSummary,
  units,
}: {
  activeDayKey: string;
  todayKey: string;
  weekStartDay: number;
  consumed: number;
  goal: number;
  activeKcal?: number;
  bmrKcal?: number;
  goalType: GoalType;
  kcalOffset: number;
  initialMode: CalorieDisplayMode;
  macros: { protein: number; carbs: number; fat: number };
  macroGoals: MacroGoals;
  weekSummary: WeekSummary | null;
  units: Units;
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-3xl border-border/60 py-0 shadow-card-lg">
      <div className="border-b border-border/60 bg-primary/[0.07] px-3 pb-3 pt-3 sm:px-4">
        <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
          <WeekSummaryLine summary={weekSummary} units={units} />
          {/* The strip is quick access to this week; the calendar opens the
              full historical view. */}
          <AppLink
            href="/calendar"
            aria-label="Open calendar"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2.5 text-primary outline-none transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <ArrowUpRight className="h-3 w-3 opacity-70" />
          </AppLink>
        </div>
        <WeekStrip
          activeDayKey={activeDayKey}
          todayKey={todayKey}
          weekStartDay={weekStartDay}
        />
      </div>

      <div className="px-5 pb-8 pt-5 sm:px-6 sm:pb-10">
        <CalorieRingBlock
          consumed={consumed}
          goal={goal}
          activeKcal={activeKcal}
          bmrKcal={bmrKcal}
          goalType={goalType}
          kcalOffset={kcalOffset}
          initialMode={initialMode}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60">
        <div className="px-4 py-4 sm:px-5">
          <MacroCard
            flat
            label="Protein"
            value={Math.round(macros.protein)}
            goal={macroGoals.protein}
            color={metricColor.protein}
          />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <MacroCard
            flat
            label="Carbs"
            value={Math.round(macros.carbs)}
            goal={macroGoals.carbs}
            color={metricColor.carbs}
          />
        </div>
        <div className="px-4 py-4 sm:px-5">
          <MacroCard
            flat
            label="Fat"
            value={Math.round(macros.fat)}
            goal={macroGoals.fat}
            color={metricColor.fat}
          />
        </div>
      </div>
    </Card>
  );
}

// The week's running balance, inline in the app bar. Links to the full /week
// breakdown.
function WeekSummaryLine({
  summary,
  units,
}: {
  summary: WeekSummary | null;
  units: Units;
}) {
  const net = summary ? Math.round(summary.netKcal) : 0;
  const weight = summary
    ? displayWeight(Math.abs(summary.predictedWeightKg), units)
    : null;

  return (
    <AppLink
      href="/week"
      aria-label="View week summary"
      className="group flex min-w-0 items-center gap-2 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground">
        This week
      </span>
      {summary && summary.loggedDays > 0 && weight ? (
        <span className="truncate text-xs">
          <span className="font-semibold tabular-nums">
            {Math.abs(net).toLocaleString()}
          </span>
          <span className="text-muted-foreground"> kcal {netBalanceWord(net)}</span>
          <span className="tabular-nums text-muted-foreground/60">
            {" "}
            · ≈{weight.value} {weight.unit}
          </span>
        </span>
      ) : (
        <span className="truncate text-xs text-muted-foreground">
          Nothing logged yet
        </span>
      )}
    </AppLink>
  );
}
