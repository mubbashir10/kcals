"use client";

// App-specific calendar built on top of <Calendar /> (shadcn / react-day-picker
// v10). Renders a month grid where each day shows up to three marker dots —
// food / weight / activity — and links to `/day/[YYYY-MM-DD]`.

import { useMemo } from "react";
import type { DayButtonProps } from "react-day-picker";

import { AppLink } from "@/components/app-link";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatYMD } from "@/lib/calendar-build";
import { dayKeyToLocalDate } from "@/lib/clock";

export type DayMarkerInput = {
  dayKey: string; // "YYYY-MM-DD"
  hasFood?: boolean;
  hasWeight?: boolean;
  hasActivity?: boolean;
};

export function MarkerCalendar({
  monthKey,
  markers,
  onMonthChange,
  navigable = true,
  className,
}: {
  monthKey: string; // "YYYY-MM"
  markers: DayMarkerInput[];
  /**
   * Called when the user clicks the rdp prev/next month buttons. Caller can
   * push a new URL to refresh server data for the new month.
   */
  onMonthChange?: (newMonthKey: string) => void;
  /** Show prev/next buttons. Off for the home widget (current month only). */
  navigable?: boolean;
  className?: string;
}) {
  const [year, month] = monthKey.split("-").map((s) => parseInt(s, 10));
  const monthDate = useMemo(() => new Date(year, month - 1, 1), [year, month]);

  // Group dayKeys → Date arrays for each modifier. react-day-picker matches
  // by calendar date, so we construct local Dates from YMD components.
  const { foodDates, weightDates, activityDates } = useMemo(() => {
    const food: Date[] = [];
    const weight: Date[] = [];
    const activity: Date[] = [];
    for (const m of markers) {
      const d = dayKeyToLocalDate(m.dayKey);
      if (m.hasFood) food.push(d);
      if (m.hasWeight) weight.push(d);
      if (m.hasActivity) activity.push(d);
    }
    return { foodDates: food, weightDates: weight, activityDates: activity };
  }, [markers]);

  // Today's calendar date for disabling future-day clicks (we still render
  // future cells, just non-interactive).
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <Calendar
      month={monthDate}
      onMonthChange={(d) => {
        const newKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        onMonthChange?.(newKey);
      }}
      hideNavigation={!navigable}
      // rdp only renders a DayButton (where our marker dots live) when it
      // sees the calendar as "interactive" — i.e. either `mode` or
      // `onDayClick` is set. We aren't a date-picker; the custom DayButton
      // handles navigation itself via AppLink. This no-op flips the switch.
      onDayClick={NOOP}
      modifiers={{
        hasFood: foodDates,
        hasWeight: weightDates,
        hasActivity: activityDates,
        future: { after: todayMidnight },
      }}
      // Hide rdp's month caption — every consumer renders its own header
      // (widget title or page H1), so showing it again is duplication.
      classNames={{ month_caption: "hidden" }}
      components={{
        DayButton: MarkerDayButton,
      }}
      className={className}
    />
  );
}

const NOOP = () => {};

// Custom DayButton: renders an <AppLink> so each cell prefetches and supports
// open-in-new-tab. react-day-picker passes us the day + modifiers; we ignore
// the button-specific props (onClick/onKeyDown) since navigation handles them.
function MarkerDayButton({
  day,
  modifiers,
  className,
}: DayButtonProps) {
  const dateKey = formatYMD(day.date);
  const hasAny = modifiers.hasFood || modifiers.hasWeight || modifiers.hasActivity;
  const dim = modifiers.outside || (modifiers.future && !modifiers.today);

  const inner = (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums leading-none sm:h-8 sm:w-8",
        modifiers.today
          ? "bg-foreground text-background"
          : dim
            ? "text-muted-foreground/40"
            : hasAny
              ? "text-foreground/90"
              : "text-muted-foreground"
      )}
    >
      {day.date.getDate()}
    </span>
  );

  const dots = (
    <span className="flex h-1 items-center gap-0.5">
      {modifiers.hasWeight && (
        <span
          className="h-1 w-1 rounded-full bg-violet-500"
          aria-label="weight logged"
        />
      )}
      {modifiers.hasActivity && (
        <span
          className="h-1 w-1 rounded-full bg-sky-500"
          aria-label="activity logged"
        />
      )}
      {modifiers.hasFood && (
        <span
          className="h-1 w-1 rounded-full bg-emerald-500"
          aria-label="food logged"
        />
      )}
    </span>
  );

  // Future days with no data: not navigable — render plain element.
  if (modifiers.future && !hasAny) {
    return (
      <div
        aria-hidden
        className={cn(
          className,
          "flex h-full w-full flex-col items-center justify-center gap-1 rounded-md"
        )}
      >
        {inner}
        {dots}
      </div>
    );
  }

  return (
    <AppLink
      href={`/day/${dateKey}`}
      aria-label={`Open ${dateKey}`}
      className={cn(
        className,
        "flex h-full w-full flex-col items-center justify-center gap-1 rounded-md transition-colors hover:bg-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
    >
      {inner}
      {dots}
    </AppLink>
  );
}

