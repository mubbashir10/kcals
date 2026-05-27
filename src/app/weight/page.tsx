import { ArrowLeft, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { db } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import { kgToLb } from "@/lib/bmr";
import { formatShortDateInTz } from "@/lib/clock";
import { round1 } from "@/lib/utils";
import { WeightChart } from "@/components/weight-chart";
import {
  WeightHistory,
  type WeightHistoryEntry,
} from "@/components/weight-history";

export const dynamic = "force-dynamic";

export default async function WeightPage() {
  const { userId, profile } = await requireProfile();
  const units = profile.units as "metric" | "imperial";
  const tz = profile.timezone || "UTC";

  const logs = await db.weightLog.findMany({
    where: { userId },
    orderBy: { loggedAt: "desc" },
  });

  const latest = logs[0] ?? null;
  const nowMs = new Date().getTime();

  // Deltas vs N days ago — find the closest log on/before that date.
  function deltaSince(daysAgo: number): number | null {
    if (!latest) return null;
    const cutoff = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000);
    const baseline = logs.find((l) => l.loggedAt <= cutoff);
    if (!baseline) return null;
    return latest.weightKg - baseline.weightKg;
  }

  const delta7d = deltaSince(7);
  const delta30d = deltaSince(30);
  const deltaAll =
    latest && logs.length > 1
      ? latest.weightKg - logs[logs.length - 1].weightKg
      : null;

  const chartPoints = logs
    .slice()
    .reverse()
    .map((l) => ({
      date: l.loggedAt.toISOString(),
      weightKg: l.weightKg,
    }));

  const historyEntries: WeightHistoryEntry[] = logs.map((l) => ({
    id: l.id,
    weightKg: l.weightKg,
    loggedAt: l.loggedAt.toISOString(),
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
          <span className="text-sm font-semibold tracking-tight">Weight</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <div className="mb-2">
          <h1 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Current
          </h1>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-5xl font-semibold leading-none tabular-nums tracking-tight">
              {latest
                ? round1(
                    units === "imperial"
                      ? kgToLb(latest.weightKg)
                      : latest.weightKg
                  ).toFixed(1)
                : "—"}
              {latest && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  {units === "imperial" ? "lb" : "kg"}
                </span>
              )}
            </div>
          </div>
          {latest && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last logged {formatTimeAgo(latest.loggedAt.toISOString(), tz)}
            </p>
          )}
        </div>

        {/* Deltas */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <DeltaCard label="7-day" deltaKg={delta7d} units={units} />
          <DeltaCard label="30-day" deltaKg={delta30d} units={units} />
          <DeltaCard label="All time" deltaKg={deltaAll} units={units} />
        </div>

        {/* Chart */}
        <section className="mt-8">
          <h2 className="mb-3 px-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Trend
          </h2>
          <WeightChart points={chartPoints} units={units} timezone={tz} />
        </section>

        {/* History */}
        <section className="mt-8">
          <div className="mb-3 flex items-baseline justify-between px-1">
            <h2 className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              History
            </h2>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <WeightHistory entries={historyEntries} units={units} timezone={tz} />
        </section>
      </main>
    </div>
  );
}

function DeltaCard({
  label,
  deltaKg,
  units,
}: {
  label: string;
  deltaKg: number | null;
  units: "metric" | "imperial";
}) {
  const unit = units === "imperial" ? "lb" : "kg";
  const value = deltaKg == null ? null : units === "imperial" ? kgToLb(deltaKg) : deltaKg;

  const direction =
    value == null
      ? "none"
      : Math.abs(value) < 0.05
      ? "flat"
      : value > 0
      ? "up"
      : "down";

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {value == null ? (
          <span className="text-base text-muted-foreground">—</span>
        ) : (
          <>
            {direction === "down" && (
              <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            )}
            {direction === "up" && (
              <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
            )}
            {direction === "flat" && (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={
                "text-base font-semibold tabular-nums tracking-tight " +
                (direction === "down"
                  ? "text-emerald-500"
                  : direction === "up"
                  ? "text-rose-500"
                  : "text-muted-foreground")
              }
            >
              {value > 0 ? "+" : value < 0 ? "−" : ""}
              {round1(Math.abs(value)).toFixed(1)}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string, tz: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatShortDateInTz(date, tz);
}

