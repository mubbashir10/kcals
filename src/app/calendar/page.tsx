import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { MarkerCalendar, type DayMarkerInput } from "@/components/marker-calendar";
import { dayKeyInTz } from "@/lib/clock";
import { metricColor } from "@/lib/metric-colors";
import {
  formatMonthLabel,
  shiftDayKey,
  shiftMonth,
} from "@/lib/calendar-build";
import { loadDayMarkers } from "@/lib/calendar-data";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const todayKey = dayKeyInTz(tz, new Date());
  const currentMonthKey = todayKey.slice(0, 7);

  const monthKey =
    typeof m === "string" && MONTH_RE.test(m) ? m : currentMonthKey;
  const prevMonthKey = shiftMonth(monthKey, -1);
  const nextMonthKey = shiftMonth(monthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;

  // Fetch markers covering the 42-cell grid that contains this month.
  const firstKey = `${monthKey}-01`;
  const startKey = shiftDayKey(firstKey, -7);
  const endKey = shiftDayKey(firstKey, 37);
  const markersMap = await loadDayMarkers(userId, startKey, endKey, tz);

  const markers: DayMarkerInput[] = Array.from(markersMap.values()).map(
    (m) => ({
      dayKey: m.dayKey,
      hasFood: m.hasFood,
      hasWeight: m.hasWeight,
      hasActivity: m.hasActivity,
    })
  );

  // Month summary — only count days that fall in `monthKey`.
  const monthPrefix = `${monthKey}-`;
  let loggedFood = 0;
  let loggedWeight = 0;
  let loggedActivity = 0;
  let totalKcal = 0;
  let kcalDays = 0;
  for (const v of markersMap.values()) {
    if (!v.dayKey.startsWith(monthPrefix)) continue;
    if (v.hasFood) {
      loggedFood += 1;
      totalKcal += v.consumedKcal;
      kcalDays += 1;
    }
    if (v.hasWeight) loggedWeight += 1;
    if (v.hasActivity) loggedActivity += 1;
  }
  const avgKcal = kcalDays > 0 ? totalKcal / kcalDays : null;

  const monthLabel = formatMonthLabel(monthKey, tz);

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <span className="text-sm font-semibold tracking-tight">Calendar</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {/* Month navigator. We render our own buttons (rdp's prev/next would
            change state client-side, but we want a fresh SSR fetch per month
            so markers stay correct). */}
        <div className="mb-6 flex items-center justify-between">
          <AppLink
            href={`/calendar?m=${prevMonthKey}`}
            direction="back"
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </AppLink>
          <h1 className="text-base font-semibold tracking-tight tabular-nums">
            {monthLabel}
          </h1>
          {canGoNext ? (
            <AppLink
              href={`/calendar?m=${nextMonthKey}`}
              direction="forward"
              aria-label="Next month"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </AppLink>
          ) : (
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground/30"
            >
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>

        <MarkerCalendar
          monthKey={monthKey}
          markers={markers}
          navigable={false}
        />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Legend color={metricColor.energy} label="food" />
          <Legend color={metricColor.weight} label="weight" />
          <Legend color={metricColor.activity} label="activity" />
        </div>

        {/* Month summary */}
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryTile label="Food" value={loggedFood} suffix="days" />
          <SummaryTile label="Weight" value={loggedWeight} suffix="days" />
          <SummaryTile label="Activity" value={loggedActivity} suffix="days" />
          <SummaryTile
            label="Avg kcal"
            value={avgKcal != null ? Math.round(avgKcal) : null}
            suffix="kcal"
          />
        </section>

        {monthKey !== currentMonthKey && (
          <div className="mt-6 text-center">
            <AppLink
              href="/calendar"
              direction="back"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Back to this month
            </AppLink>
          </div>
        )}
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold tabular-nums tracking-tight">
        {value == null ? (
          <span className="text-base font-normal text-muted-foreground">
            —
          </span>
        ) : (
          <>
            {value.toLocaleString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {suffix}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
