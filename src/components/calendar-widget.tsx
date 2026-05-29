import { CalendarDays, ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MarkerCalendar, type DayMarkerInput } from "@/components/marker-calendar";
import { WidgetMenu } from "@/components/widget-menu";
import { formatMonthLabel } from "@/lib/calendar-build";

export type CalendarWidgetProps = {
  monthKey: string;
  markers: DayMarkerInput[];
  timezone: string;
};

export function CalendarWidget({
  monthKey,
  markers,
  timezone,
}: CalendarWidgetProps) {
  const monthLabel = formatMonthLabel(monthKey, timezone);

  return (
    <Card className="rounded-2xl border-border/60 p-5 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <AppLink
          href="/calendar"
          aria-label="Open calendar"
          className="group inline-flex items-center gap-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <CalendarDays className="h-3.5 w-3.5 text-emerald-500/80" />
          <span className="text-sm font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors group-hover:text-foreground/80">
            {monthLabel}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </AppLink>
        <WidgetMenu widgetId="calendar" label="Calendar" size="sm" />
      </div>

      <MarkerCalendar
        monthKey={monthKey}
        markers={markers}
        navigable={false}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} aria-hidden />
      {label}
    </span>
  );
}
