import { redirect } from "next/navigation";
import { ArrowLeft, Flame } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { CaloriesChart } from "@/components/calories-chart";
import { CaloriesHistory } from "@/components/calories-history";
import { loadDailyHistory } from "@/lib/daily-history";
import { dayKeyInTz } from "@/lib/clock";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CaloriesPage() {
  const userId = await requireUserId();
  const data = await loadDailyHistory(userId, 365);
  if (!data) redirect("/setup");

  const { tz, entries } = data;
  const todayKey = dayKeyInTz(tz, new Date());

  // Days with at least one logged food — drives the "current" hero, chart,
  // and the deltas. Days with zero kcal would otherwise drag averages.
  const eaten = entries.filter((e) => e.hasFood);
  const todayEntry = entries.find((e) => e.dayKey === todayKey) ?? null;
  const latestEaten = eaten[0] ?? null;
  const hero = todayEntry?.hasFood ? todayEntry : latestEaten;

  const sevenAvg = avgConsumed(eaten.slice(0, 7));
  const thirtyAvg = avgConsumed(eaten.slice(0, 30));
  const allTimeAvg = avgConsumed(eaten);

  const chartPoints = entries
    .slice(0, 90)
    .map((e) => ({
      dayKey: e.dayKey,
      consumed: e.consumed.kcal,
      goal: e.calorieGoal,
    }));

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
          <span className="text-sm font-semibold tracking-tight">
            Calories & macros
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-2">
          <h1 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {todayEntry?.hasFood
              ? "Today"
              : hero
                ? "Latest"
                : "Today"}
          </h1>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-5xl font-semibold leading-none tabular-nums tracking-tight">
              {hero ? Math.round(hero.consumed.kcal).toLocaleString() : "—"}
              {hero && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  kcal
                </span>
              )}
            </div>
          </div>
          {hero && (
            <p className="mt-2 text-xs text-muted-foreground tabular-nums">
              of {hero.calorieGoal.toLocaleString()} goal
              {formatDeltaHint(hero.consumed.kcal, hero.calorieGoal)}
            </p>
          )}
        </div>

        {/* Averages */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <AverageCard label="7-day avg" avg={sevenAvg} />
          <AverageCard label="30-day avg" avg={thirtyAvg} />
          <AverageCard label="All-time" avg={allTimeAvg} />
        </div>

        {/* Chart */}
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Trend
          </h2>
          <CaloriesChart points={chartPoints} timezone={tz} />
        </section>

        {/* History */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              History
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {entries.length} {entries.length === 1 ? "day" : "days"}
            </span>
          </div>
          <CaloriesHistory entries={entries} timezone={tz} />
        </section>
      </main>
    </div>
  );
}

function avgConsumed(
  entries: { consumed: { kcal: number } }[]
): number | null {
  if (entries.length === 0) return null;
  const total = entries.reduce((acc, e) => acc + e.consumed.kcal, 0);
  return total / entries.length;
}

function formatDeltaHint(consumed: number, goal: number): string {
  if (goal <= 0) return "";
  const delta = Math.round(consumed - goal);
  if (Math.abs(delta) < 1) return " · on target";
  return delta > 0
    ? ` · +${delta.toLocaleString()} over`
    : ` · ${Math.abs(delta).toLocaleString()} under`;
}

function AverageCard({
  label,
  avg,
}: {
  label: string;
  avg: number | null;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        {avg == null ? (
          <span className="text-base text-muted-foreground">—</span>
        ) : (
          <>
            <Flame className="h-3 w-3 text-emerald-500/70" />
            <span className="text-base font-semibold tabular-nums tracking-tight">
              {Math.round(avg).toLocaleString()}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                kcal
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

