import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flame,
  Footprints,
  Scale,
  Target,
  Utensils,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { MacroCard } from "@/components/macro-card";
import { MarkerCalendar, type DayMarkerInput } from "@/components/marker-calendar";
import { displayWeight, type Units } from "@/lib/bmr";
import { dayKeyInTz, formatLongDateInTz, startOfDayForDayKey } from "@/lib/clock";
import { metricColor, metricTint } from "@/lib/metric-colors";
import { formatMonthLabel, shiftDayKey, shiftMonth } from "@/lib/calendar-build";
import { loadDayMarkers } from "@/lib/calendar-data";
import { loadDayDetail } from "@/lib/day-detail";
import { requireProfile } from "@/lib/session";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    typeof d === "string" && DAY_RE.test(d) && d <= todayKey ? d : todayKey;

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

  // Selected-day figures for the summary card.
  const eaten = Math.round(detail.consumed.kcal);
  const burned = Math.round(detail.activeKcal);
  const remaining = Math.round(detail.calorieGoal - detail.consumed.kcal);
  const overGoal = remaining < 0;
  const steps = detail.activityLog?.steps ?? null;
  const weightDisplay =
    detail.weight != null ? displayWeight(detail.weight.weightKg, units) : null;
  const isToday = selectedKey === todayKey;
  const dayLabel = formatLongDateInTz(
    startOfDayForDayKey(tz, selectedKey),
    tz
  );

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
        <div className="mb-6 flex items-center justify-between">
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

        <MarkerCalendar
          monthKey={monthKey}
          markers={markers}
          navigable={false}
          selectHref
          selectedKey={selectedKey}
        />

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <Legend color={metricColor.energy} label="food" />
          <Legend color={metricColor.weight} label="weight" />
          <Legend color={metricColor.activity} label="activity" />
        </div>

        {/* Selected-day summary */}
        <Card className="mt-8 rounded-3xl border-border/60 p-5 shadow-card-lg sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">
              {isToday ? "Today" : dayLabel}
            </h2>
            <AppLink
              href={`/day/${selectedKey}`}
              aria-label="Open full day"
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Open day
              <ArrowRight className="h-3.5 w-3.5" />
            </AppLink>
          </div>

          {/* Calories */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <StatTile
              icon={Utensils}
              color={metricColor.energy}
              label="Eaten"
              value={eaten}
              suffix="kcal"
            />
            <StatTile
              icon={Flame}
              color={metricColor.activity}
              label="Burned"
              value={burned}
              suffix="kcal"
            />
            <StatTile
              icon={Target}
              color={overGoal ? "var(--destructive)" : metricColor.energy}
              label={overGoal ? "Over" : "Left"}
              value={Math.abs(remaining)}
              suffix="kcal"
            />
          </div>

          {/* Macros */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MacroCard
              label="Protein"
              value={Math.round(detail.consumed.protein)}
              goal={detail.macroGoals.protein}
              color={metricColor.protein}
            />
            <MacroCard
              label="Carbs"
              value={Math.round(detail.consumed.carbs)}
              goal={detail.macroGoals.carbs}
              color={metricColor.carbs}
            />
            <MacroCard
              label="Fat"
              value={Math.round(detail.consumed.fat)}
              goal={detail.macroGoals.fat}
              color={metricColor.fat}
            />
          </div>

          {/* Steps + weight */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile
              icon={Footprints}
              color={metricColor.calendar}
              label="Steps"
              value={steps != null && steps > 0 ? steps : null}
            />
            <StatTile
              icon={Scale}
              color={metricColor.weight}
              label="Weight"
              value={weightDisplay?.value ?? null}
              suffix={weightDisplay?.unit}
            />
          </div>
        </Card>

        {/* Month summary */}
        <section className="mt-6">
          <h2 className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {monthLabel}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Food" value={loggedFood} suffix="days" />
            <SummaryTile label="Weight" value={loggedWeight} suffix="days" />
            <SummaryTile label="Activity" value={loggedActivity} suffix="days" />
            <SummaryTile
              label="Avg kcal"
              value={avgKcal != null ? Math.round(avgKcal) : null}
              suffix="kcal"
            />
          </div>
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

// Colorful stat tile — tinted background, colored icon, big number + label.
// `value` is null → renders an em dash (nothing logged for that metric).
function StatTile({
  icon: Icon,
  color,
  label,
  value,
  suffix,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  value: number | string | null;
  suffix?: string;
}) {
  return (
    <div
      className="rounded-2xl border border-border/60 p-3.5 shadow-card sm:p-4"
      style={{ backgroundColor: metricTint(color, 8) }}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color }} strokeWidth={2} />
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1 leading-none">
        {value == null ? (
          <span className="text-base font-normal text-muted-foreground">—</span>
        ) : (
          <>
            <span className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
              {typeof value === "number" ? value.toLocaleString() : value}
            </span>
            {suffix && (
              <span className="text-[11px] text-muted-foreground/80">
                {suffix}
              </span>
            )}
          </>
        )}
      </div>
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
          <span className="text-base font-normal text-muted-foreground">—</span>
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
