"use client";

// App-specific calendar built on top of <Calendar /> (shadcn / react-day-picker
// v10). Renders a month grid where each day shows up to three marker dots —
// food / weight / activity. Cells either link to `/day/[YYYY-MM-DD]` (the
// default) or, in `selectHref` mode, to `/calendar?d=…` so the calendar page
// can swap its day summary without leaving the page.

import { useMemo } from "react";
import type { DayButtonProps } from "react-day-picker";

import { AppLink } from "@/components/app-link";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { metricColor } from "@/lib/metric-colors";
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
  selectHref = false,
  selectedKey,
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
  /** Link cells to `/calendar?d=…` (select-in-place) instead of `/day/…`. */
  selectHref?: boolean;
  /** dayKey to render as the selected cell (only meaningful with selectHref). */
  selectedKey?: string;
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

  const selectedDates = useMemo(
    () => (selectedKey ? [dayKeyToLocalDate(selectedKey)] : []),
    [selectedKey]
  );

  // Today's calendar date for disabling future-day clicks (we still render
  // future cells, just non-interactive).
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Stable-per-config DayButton so cells know the link target. rdp re-mounts
  // cells only when this identity changes (i.e. month or link mode changes).
  const DayButton = useMemo(
    () => makeDayButton(monthKey, selectHref),
    [monthKey, selectHref]
  );

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
        selectedDay: selectedDates,
        future: { after: todayMidnight },
      }}
      // Hide rdp's month caption — every consumer renders its own header
      // (widget title or page H1), so showing it again is duplication.
      classNames={{ month_caption: "hidden" }}
      components={{ DayButton }}
      className={className}
    />
  );
}

const NOOP = () => {};

// Custom DayButton factory: renders an <AppLink> so each cell prefetches and
// supports open-in-new-tab. react-day-picker passes us the day + modifiers;
// we ignore the button-specific props (onClick/onKeyDown) since navigation
// handles them.
function makeDayButton(monthKey: string, selectHref: boolean) {
  function MarkerDayButton({ day, modifiers, className }: DayButtonProps) {
    const dateKey = formatYMD(day.date);
    const hasAny =
      modifiers.hasFood || modifiers.hasWeight || modifiers.hasActivity;
    const dim = modifiers.outside || (modifiers.future && !modifiers.today);
    const selected = modifiers.selectedDay;

    const inner = (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium tabular-nums leading-none sm:h-9 sm:w-9 sm:text-base",
          modifiers.today
            ? "bg-foreground text-background"
            : selected
              ? "text-primary"
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
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: metricColor.weight }}
            aria-label="weight logged"
          />
        )}
        {modifiers.hasActivity && (
          <span
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: metricColor.activity }}
            aria-label="activity logged"
          />
        )}
        {modifiers.hasFood && (
          <span
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: metricColor.energy }}
            aria-label="food logged"
          />
        )}
      </span>
    );

    // Cell background: selected wins, then a faint wash for logged-food days.
    const cellBg = selected
      ? "bg-primary/12 ring-1 ring-inset ring-primary/60"
      : modifiers.hasFood && !dim
        ? "bg-primary/[0.05]"
        : "";

    const shell =
      "flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl transition-colors";

    // Future days with no data: not navigable — render plain element.
    if (modifiers.future && !hasAny) {
      return (
        <div aria-hidden className={cn(className, shell, cellBg)}>
          {inner}
          {dots}
        </div>
      );
    }

    return (
      <AppLink
        href={
          selectHref ? `/calendar?m=${monthKey}&d=${dateKey}` : `/day/${dateKey}`
        }
        direction={selectHref ? "none" : "forward"}
        aria-label={`Open ${dateKey}`}
        aria-current={selected ? "date" : undefined}
        className={cn(
          className,
          shell,
          cellBg,
          "outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/40"
        )}
      >
        {inner}
        {dots}
      </AppLink>
    );
  }

  return MarkerDayButton;
}
