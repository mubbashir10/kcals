import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EqDayBalance } from "@/components/energy-equation";
import { MarkerCalendar, type DayMarkerInput } from "@/components/marker-calendar";
import { displayWeight, type Units } from "@/lib/bmr";
import { dayKeyInTz, formatLongDateInTz, isDayKey, startOfDayForDayKey } from "@/lib/clock";
import { metricColor } from "@/lib/metric-colors";
import { formatMonthLabel, shiftDayKey, shiftMonth } from "@/lib/calendar-build";
import { loadDayMarkers } from "@/lib/calendar-data";
import { loadDayDetail } from "@/lib/day-detail";
import type { MacroGoal } from "@/lib/macros";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const { m, d } = await searchParams;
  const { userId, profile } = await requireProfile();
  const tz = profile.timezone || "UTC";
  const units = profile.units as Units;
  const todayKey = dayKeyInTz(tz, new Date());
  const currentMonthKey = todayKey.slice(0, 7);

  // Selected day drives the summary card. Default to today; never the future.
  const selectedKey =
    typeof d === "string" && isDayKey(d) && d <= todayKey ? d : todayKey;

  // Displayed month. Explicit `m` wins (month paging); otherwise the selected
  // day's month.
  const monthKey =
    typeof m === "string" && MONTH_RE.test(m) ? m : selectedKey.slice(0, 7);
  const prevMonthKey = shiftMonth(monthKey, -1);
  const nextMonthKey = shiftMonth(monthKey, 1);
  const canGoNext = nextMonthKey <= currentMonthKey;

  // Markers for the 42-cell grid + the selected day's full detail, together.
  const firstKey = `${monthKey}-01`;
  const startKey = shiftDayKey(firstKey, -7);
  const endKey = shiftDayKey(firstKey, 37);
  const [markersMap, detail] = await Promise.all([
    loadDayMarkers(userId, startKey, endKey, tz),
    loadDayDetail(userId, profile, selectedKey),
  ]);

  const markers: DayMarkerInput[] = Array.from(markersMap.values()).map((v) => ({
    dayKey: v.dayKey,
    hasFood: v.hasFood,
    hasWeight: v.hasWeight,
    hasActivity: v.hasActivity,
  }));

  // Month summary — only count days that fall in `monthKey`.
  const monthPrefix = `${monthKey}-`;
  let loggedFood = 0;
  let loggedWeight = 0;
  let loggedActivity = 0;
  let totalKcal = 0;
  for (const v of markersMap.values()) {
    if (!v.dayKey.startsWith(monthPrefix)) continue;
    if (v.hasFood) {
      loggedFood += 1;
      totalKcal += v.consumedKcal;
    }
    if (v.hasWeight) loggedWeight += 1;
    if (v.hasActivity) loggedActivity += 1;
  }
  const avgKcal = loggedFood > 0 ? Math.round(totalKcal / loggedFood) : null;

  const monthLabel = formatMonthLabel(monthKey, tz);

  // Selected-day figures. Same equation the day page leads with, so this reads
  // as a preview of it rather than a second, differently-shaped truth.
  const eaten = Math.round(detail.consumed.kcal);
  const burned = Math.round(detail.activeKcal);
  const bmr = Math.round(detail.bmrKcal);
  const goal = Math.round(detail.calorieGoal);
  const steps = detail.activityLog?.steps ?? null;
  const weightDisplay =
    detail.weight != null ? displayWeight(detail.weight.weightKg, units) : null;
  const isToday = selectedKey === todayKey;
  const dayLabel = formatLongDateInTz(startOfDayForDayKey(tz, selectedKey), tz);

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
            so markers stay correct). The selected day is preserved. */}
        <div className="flex items-center justify-between">
          <AppLink
            href={`/calendar?m=${prevMonthKey}&d=${selectedKey}`}
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
              href={`/calendar?m=${nextMonthKey}&d=${selectedKey}`}
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

        {/* The month's totals double as the grid's legend: each dot is the one
            you'll see under a day, and the count is how many days carry it. */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-border/60 py-3 text-xs">
          <MonthStat color={metricColor.energy} label="food" value={loggedFood} unit="days" />
          <MonthStat color={metricColor.weight} label="weight" value={loggedWeight} unit="days" />
          <MonthStat color={metricColor.activity} label="activity" value={loggedActivity} unit="days" />
          <MonthStat
            label="avg"
            value={avgKcal}
            unit="kcal"
          />
        </div>

        <div className="mt-5">
          <MarkerCalendar
            monthKey={monthKey}
            markers={markers}
            navigable={false}
            selectHref
            selectedKey={selectedKey}
          />
        </div>

        {/* Selected-day preview. Deliberately not the whole day page — the
            balance, the macros, and the two body metrics, stacked. */}
        <Card className="mt-8 gap-0 rounded-3xl border-border/60 p-0 shadow-card-lg">
          <AppLink
            href={`/day/${selectedKey}`}
            className="flex items-center justify-between gap-3 rounded-t-3xl px-5 py-4 outline-none transition-colors hover:bg-accent/30 focus-visible:bg-accent/30 sm:px-6"
          >
            <h2 className="text-sm font-semibold tracking-tight">
              {isToday ? "Today" : dayLabel}
            </h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              Open day
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </AppLink>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border/60 px-5 py-4 text-[13px] sm:px-6">
            <EqDayBalance bmr={bmr} burned={burned} eaten={eaten} goal={goal} />
          </div>

          <div className="space-y-3.5 border-t border-border/60 px-5 py-4 sm:px-6">
            <MacroRow
              label="Protein"
              value={Math.round(detail.consumed.protein)}
              goal={detail.macroGoals.protein}
              color={metricColor.protein}
            />
            <MacroRow
              label="Carbs"
              value={Math.round(detail.consumed.carbs)}
              goal={detail.macroGoals.carbs}
              color={metricColor.carbs}
            />
            <MacroRow
              label="Fat"
              value={Math.round(detail.consumed.fat)}
              goal={detail.macroGoals.fat}
              color={metricColor.fat}
            />
          </div>

          <div className="border-t border-border/60 px-5 py-2 sm:px-6">
            <MetricRow
              icon={Footprints}
              color={metricColor.activity}
              label="Steps"
              value={steps != null && steps > 0 ? steps.toLocaleString() : null}
            />
            <MetricRow
              icon={Scale}
              color={metricColor.weight}
              label="Weight"
              value={
                weightDisplay
                  ? `${weightDisplay.value} ${weightDisplay.unit}`
                  : null
              }
            />
          </div>
        </Card>

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

// `color` is set for the three marker metrics — the dot is the legend for the
// grid below. The average has no marker, so no dot.
function MonthStat({
  color,
  label,
  value,
  unit,
}: {
  color?: string;
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      {color && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {label}
      <span className="font-semibold tabular-nums text-foreground">
        {value != null ? value.toLocaleString() : "—"}
      </span>
      {unit}
    </span>
  );
}

// Macro as a full-width row: name and amount on one line, bar beneath. Reads
// down the card instead of squeezing three numbers across it.
function MacroRow({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: MacroGoal;
  color: string;
}) {
  const tracked = goal.kind !== "off";
  const goalG = tracked ? goal.g : null;
  const pct = goalG && goalG > 0 ? Math.min((value / goalG) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          {label}
        </span>
        <span className="text-sm tabular-nums">
          <span className="font-semibold">{value}</span>
          <span className="text-muted-foreground/70">
            {tracked ? ` / ${goalG} g` : " g"}
          </span>
        </span>
      </div>
      <Progress value={pct} indicatorColor={color} className="mt-1.5" />
    </div>
  );
}

// A body metric that either has a value or doesn't. `null` renders an em dash.
function MetricRow({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" style={{ color }} strokeWidth={2} />
        {label}
      </span>
      <span className="text-sm tabular-nums">
        {value ?? <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  );
}
