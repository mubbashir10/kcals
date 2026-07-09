// Horizontal week-day selector — the primary day navigator, shared by the
// home dashboard (today's week) and the /day/[date] page (the viewed day's
// week). Pure links + static labels, so it stays a server component and plays
// nicely with view transitions. All inputs are already tz-resolved dayKeys,
// so nothing here needs the timezone.

import { AppLink } from "@/components/app-link";
import { cn } from "@/lib/utils";
import { parseDayKey } from "@/lib/clock";
import { weekStartKeyFor, weekDayKeys, weekdayOfDayKey } from "@/lib/week";

// Indexed by getUTCDay() (0=Sun … 6=Sat).
const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekStrip({
  activeDayKey,
  todayKey,
  weekStartDay,
  className,
}: {
  /** The day currently in view — its pill is highlighted. */
  activeDayKey: string;
  /** "YYYY-MM-DD" of today in the user's tz. */
  todayKey: string;
  /** Weekday the week begins on (0=Sun … 6=Sat). */
  weekStartDay: number;
  className?: string;
}) {
  const weekStart = weekStartKeyFor(activeDayKey, weekStartDay);
  const days = weekDayKeys(weekStart);

  return (
    <nav
      aria-label="Days of the week"
      className={cn("grid grid-cols-7 gap-1.5", className)}
    >
      {days.map((key) => {
        const isActive = key === activeDayKey;
        const isToday = key === todayKey;
        const isFuture = key > todayKey;
        const dayNum = parseDayKey(key).day;
        const label = WEEKDAY_ABBR[weekdayOfDayKey(key)];

        const base =
          "flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5";

        // Future days can't be logged into — show them dimmed and inert.
        if (isFuture) {
          return (
            <div
              key={key}
              aria-hidden
              className={cn(base, "text-muted-foreground/30")}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {label}
              </span>
              <span className="text-base font-semibold leading-none tabular-nums">
                {dayNum}
              </span>
            </div>
          );
        }

        return (
          <AppLink
            key={key}
            href={isToday ? "/" : `/day/${key}`}
            direction="none"
            aria-current={isActive ? "date" : undefined}
            aria-label={`${label} ${dayNum}${isToday ? " (today)" : ""}`}
            className={cn(
              base,
              "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              isActive
                ? "bg-primary text-primary-foreground shadow-card"
                : cn(
                    "text-foreground hover:bg-muted/60",
                    // Today, when you're viewing another day, gets a hint ring.
                    isToday && "ring-1 ring-inset ring-primary/50"
                  )
            )}
          >
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                isActive ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            <span className="text-base font-semibold leading-none tabular-nums">
              {dayNum}
            </span>
          </AppLink>
        );
      })}
    </nav>
  );
}
