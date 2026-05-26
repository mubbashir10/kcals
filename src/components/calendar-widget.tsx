import { CalendarDays, ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MarkerCalendar, type DayMarkerInput } from "@/components/marker-calendar";
import { WidgetMenu } from "@/components/widget-menu";
import { formatMonthLabel } from "@/lib/calendar-build";
import type { WidgetState } from "@/lib/widget-order";

export type CalendarWidgetProps = {
  monthKey: string;
  markers: DayMarkerInput[];
  timezone: string;
  state: Exclude<WidgetState, "hidden">;
  /** "logged days this month" count, shown on the minimized variant. */
  loggedCount: number;
};

export function CalendarWidget({
  monthKey,
  markers,
  timezone,
  state,
  loggedCount,
}: CalendarWidgetProps) {
  const monthLabel = formatMonthLabel(monthKey, timezone);

  if (state === "minimized") {
    return (
      <Card className="group relative rounded-2xl border-border/60 px-5 py-3 shadow-card transition-colors hover:bg-accent/20">
        <AppLink
          href="/calendar"
          aria-label="Open calendar"
          className="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Calendar
            </span>
          </div>
          <WidgetMenu
            widgetId="calendar"
            current="minimized"
            label="Calendar"
            size="sm"
          />
        </div>
        <div className="relative mt-1 text-sm font-medium tabular-nums">
          {monthLabel}
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">
            {loggedCount} {loggedCount === 1 ? "day" : "days"} logged
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border/60 p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <AppLink
          href="/calendar"
          aria-label="Open calendar"
          className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <CalendarDays className="h-3.5 w-3.5 text-emerald-500/80" />
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground/80">
            {monthLabel}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </AppLink>
        <WidgetMenu
          widgetId="calendar"
          current="expanded"
          label="Calendar"
          size="sm"
        />
      </div>

      <MarkerCalendar
        monthKey={monthKey}
        markers={markers}
        navigable={false}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <Legend color="bg-emerald-500" label="food" />
        <Legend color="bg-violet-500" label="weight" />
        <Legend color="bg-sky-500" label="activity" />
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1 w-1 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}
