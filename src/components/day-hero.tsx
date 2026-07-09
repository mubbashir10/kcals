// The home dashboard's hero: the week-day strip and the calorie ring sit in
// one card so they read as a single section (the week you're on + where today
// stands). Server component — the strip renders on the server and only the
// ring's remaining/consumed toggle is a nested client island.

import { CalendarDays } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { WeekStrip } from "@/components/week-strip";
import { CalorieRingBlock } from "@/components/calorie-ring-block";
import type { CalorieDisplayMode } from "@/components/calorie-ring";
import { metricColor } from "@/lib/metric-colors";
import type { GoalType } from "@/lib/goal";
import type { MacroGoals } from "@/lib/macros";

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
}) {
  return (
    <Card className="gap-0 rounded-3xl border-border/60 py-0 shadow-card-lg">
      {/* The strip is quick access to this week; the calendar button opens the
          full historical view. */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-4 sm:gap-2 sm:px-4">
        <WeekStrip
          activeDayKey={activeDayKey}
          todayKey={todayKey}
          weekStartDay={weekStartDay}
          className="flex-1"
        />
        <AppLink
          href="/calendar"
          aria-label="Open calendar"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <CalendarDays className="h-4 w-4" />
        </AppLink>
      </div>
      <div className="border-t border-border/60 px-5 pb-8 pt-5 sm:px-6 sm:pb-10">
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
