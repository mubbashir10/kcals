import { ArrowLeft, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/session";
import { displayWeight, type Units } from "@/lib/bmr";
import { parseDayKey } from "@/lib/clock";
import { goalPaceLabel, KCAL_PER_KG } from "@/lib/goal";
import { loadWeekSummary, type WeekSummary } from "@/lib/week";

export const dynamic = "force-dynamic";

// Below this the energy-balance prediction is just noise — call it maintenance.
const NOISE_FLOOR_KG = 0.05;
// How close to the goal-pace target still counts as "on track" (±15%).
const ON_TRACK_BAND = 0.15;

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const { userId, profile } = await requireProfile();
  const units = profile.units as Units;

  // loadWeekSummary validates + snaps any week param, so pass it through raw.
  const summary = await loadWeekSummary(
    userId,
    profile,
    typeof w === "string" ? w : null
  );

  const rangeLabel = formatRange(summary.startKey, summary.endKey);
  const verdict = weightVerdict(summary, units);
  const goalLine = goalComparison(summary, units);

  // Deficit is negative net; show the magnitude with a deficit/surplus word.
  const net = Math.round(summary.netKcal);
  const isDeficit = net < 0;
  const netWord = net === 0 ? "balanced" : isDeficit ? "deficit" : "surplus";

  return (
    <div className="relative flex flex-1 flex-col">
      <div
        aria-hidden
        className="ambient pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px]"
      />

      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-2 px-6">
          <AppLink
            href="/"
            direction="back"
            aria-label="Back"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <div className="flex flex-1 items-center justify-center gap-1">
            <AppLink
              href={`/week?w=${summary.prevStartKey}`}
              direction="back"
              aria-label="Previous week"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </AppLink>
            <span className="px-1 text-sm font-semibold tracking-tight">
              {summary.isCurrentWeek ? "This week" : rangeLabel}
            </span>
            {summary.canGoNext ? (
              <AppLink
                href={`/week?w=${summary.nextStartKey}`}
                direction="forward"
                aria-label="Next week"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </AppLink>
            ) : (
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground/30"
              >
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
          <span className="h-8 w-8" aria-hidden />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        {summary.isCurrentWeek && (
          <p className="mb-6 text-center text-xs text-muted-foreground tabular-nums">
            {rangeLabel}
          </p>
        )}

        {/* Hero — net balance + predicted weight verdict */}
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Net energy balance
          </h2>
          {summary.loggedDays === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing logged this week yet. Log a day to see your balance.
            </p>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-3">
                <div className="text-5xl font-semibold leading-none tabular-nums tracking-tight">
                  {Math.abs(net).toLocaleString()}
                </div>
                <span className="text-base font-normal text-muted-foreground">
                  kcal {netWord}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <VerdictIcon tone={verdict.tone} />
                <p className="text-sm text-foreground/90">{verdict.text}</p>
              </div>
              {goalLine && (
                <p className="mt-1 text-xs text-muted-foreground">{goalLine}</p>
              )}
            </>
          )}
        </section>

        {/* Consumed / burned over logged days */}
        <section className="mt-8 grid grid-cols-2 gap-3">
          <StatTile
            label="Consumed"
            value={Math.round(summary.consumedKcal).toLocaleString()}
            unit="kcal"
            hint="food you logged"
          />
          <StatTile
            label="Burned"
            value={Math.round(summary.burnedKcal).toLocaleString()}
            unit="kcal"
            hint="TDEE, same days"
          />
        </section>
        <p className="mt-3 px-1 text-[11px] text-muted-foreground">
          Based on{" "}
          <span className="font-medium text-foreground/80">
            {summary.loggedDays} of 7 days
          </span>{" "}
          you logged. Unlogged days are assumed at maintenance and left out of
          the balance.
        </p>

        {/* Daily breakdown */}
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Daily breakdown
          </h2>
          <Card className="divide-y divide-border/60 overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
            {summary.days.map((d) => (
              <DayRow key={d.dayKey} day={d} />
            ))}
          </Card>
        </section>
      </main>
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-2 text-2xl font-semibold leading-none tabular-nums tracking-tight">
        {value}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          {unit}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

function DayRow({ day }: { day: WeekSummary["days"][number] }) {
  const { weekday, date } = formatDayParts(day.dayKey);
  const net = day.netKcal != null ? Math.round(day.netKcal) : null;

  const inner = (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="w-9 shrink-0 text-sm font-semibold tracking-tight">
          {weekday}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {date}
        </span>
        {day.isToday && (
          <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-foreground/70">
            Today
          </span>
        )}
      </div>

      {day.isFuture ? (
        <span className="text-[11px] text-muted-foreground/50">—</span>
      ) : day.hasFood ? (
        <div className="flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="font-medium text-foreground/80">
              {Math.round(day.consumedKcal).toLocaleString()}
            </span>{" "}
            in
          </span>
          <span>
            <span className="font-medium text-foreground/80">
              {Math.round(day.tdeeKcal).toLocaleString()}
            </span>{" "}
            out
          </span>
          <span
            className={
              net != null && net < 0
                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                : "font-semibold text-foreground"
            }
          >
            {net != null && net > 0 ? "+" : ""}
            {net?.toLocaleString()}
          </span>
        </div>
      ) : (
        <span className="text-[11px] text-muted-foreground/70">Not logged</span>
      )}
    </div>
  );

  if (day.isFuture) return inner;

  return (
    <AppLink
      href={`/day/${day.dayKey}`}
      className="block outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40"
    >
      {inner}
    </AppLink>
  );
}

function VerdictIcon({ tone }: { tone: "down" | "up" | "neutral" }) {
  const cls = "h-4 w-4 shrink-0";
  if (tone === "down")
    return <TrendingDown className={`${cls} text-emerald-600 dark:text-emerald-400`} />;
  if (tone === "up")
    return <TrendingUp className={`${cls} text-amber-600 dark:text-amber-400`} />;
  return <Minus className={`${cls} text-muted-foreground`} />;
}

function weightVerdict(
  s: WeekSummary,
  units: Units
): { tone: "down" | "up" | "neutral"; text: string } {
  if (s.loggedDays === 0) {
    return { tone: "neutral", text: "No days logged yet." };
  }
  const kg = Math.abs(s.predictedWeightKg);
  if (kg < NOISE_FLOOR_KG) {
    return {
      tone: "neutral",
      text: "Right around maintenance — no real weight change expected.",
    };
  }
  const { value, unit } = displayWeight(kg, units);
  const lost = s.netKcal < 0;
  return {
    tone: lost ? "down" : "up",
    text: `At this balance you'd have ${lost ? "lost" : "gained"} about ${value} ${unit}.`,
  };
}

// Optional comparison against the user's loss/gain goal pace.
function goalComparison(s: WeekSummary, units: Units): string | null {
  if ((s.goalType !== "loss" && s.goalType !== "gain") || !s.goalPace) {
    return null;
  }
  if (s.loggedDays === 0) return null;

  const targetKg = Math.abs(s.targetNetKcal) / KCAL_PER_KG;
  const { value, unit } = displayWeight(targetKg, units);
  const paceLabel = goalPaceLabel(s.goalPace).toLowerCase();

  // How does actual net compare to the target net? Same sign expected. This
  // branch only runs for a loss/gain goal with a pace and ≥1 logged day, so
  // `target` is always non-zero.
  const diff = s.netKcal - s.targetNetKcal; // for loss, more-negative actual = ahead
  const ahead = s.goalType === "loss" ? diff < 0 : diff > 0;
  const close = Math.abs(diff) < ON_TRACK_BAND * Math.abs(s.targetNetKcal);

  const base = `Your ${paceLabel} ${s.goalType} pace targets ~${value} ${unit} over these ${s.loggedDays} day${s.loggedDays === 1 ? "" : "s"}`;
  if (close) return `${base} — you're on track.`;
  return `${base} — you're ${ahead ? "ahead of" : "behind"} pace.`;
}

// "May 25 – 31" or "May 28 – Jun 3".
function formatRange(startKey: string, endKey: string): string {
  const start = noonUTC(startKey);
  const end = noonUTC(endKey);
  const startMonth = start.toLocaleDateString("en-US", { month: "short" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short" });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay} – ${endDay}`
    : `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
}

function formatDayParts(dayKey: string): { weekday: string; date: string } {
  const d = noonUTC(dayKey);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    date: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

function noonUTC(dayKey: string): Date {
  const { year, month, day } = parseDayKey(dayKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
