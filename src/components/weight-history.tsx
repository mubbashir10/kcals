"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { kgToLb } from "@/lib/bmr";
import { formatTimeInTz, startOfDayInTz } from "@/lib/clock";
import { deleteWeightLog } from "@/app/actions/weight";

export type WeightHistoryEntry = {
  id: number;
  weightKg: number;
  loggedAt: string;
};

export function WeightHistory({
  entries,
  units,
  timezone,
}: {
  entries: WeightHistoryEntry[];
  units: "metric" | "imperial";
  timezone: string;
}) {
  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
        <p className="text-sm text-muted-foreground">No weigh-ins yet.</p>
      </Card>
    );
  }

  // Compute change vs previous entry (sorted descending by date,
  // so "previous" is the next item in the array)
  const deltas = entries.map((e, i) => {
    const next = entries[i + 1];
    return next ? e.weightKg - next.weightKg : null;
  });

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-none">
      <ul className="divide-y divide-border/60">
        {entries.map((entry, i) => (
          <WeightHistoryRow
            key={entry.id}
            entry={entry}
            delta={deltas[i]}
            units={units}
            timezone={timezone}
          />
        ))}
      </ul>
    </Card>
  );
}

function WeightHistoryRow({
  entry,
  delta,
  units,
  timezone,
}: {
  entry: WeightHistoryEntry;
  delta: number | null;
  units: "metric" | "imperial";
  timezone: string;
}) {
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      await deleteWeightLog(entry.id);
    });
  }

  const value = units === "imperial" ? kgToLb(entry.weightKg) : entry.weightKg;
  const unit = units === "imperial" ? "lb" : "kg";
  const dateStr = formatHistoryDate(entry.loggedAt, timezone);
  const timeStr = formatTimeInTz(entry.loggedAt, timezone);

  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40",
        pending && "opacity-50"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{dateStr}</div>
        <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {timeStr}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">
            {round1(value).toFixed(1)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              {unit}
            </span>
          </div>
          {delta != null && Math.abs(delta) >= 0.05 && (
            <div
              className={cn(
                "text-[10px] font-medium tabular-nums",
                delta < 0 ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {delta < 0 ? "−" : "+"}
              {round1(
                units === "imperial" ? Math.abs(kgToLb(delta)) : Math.abs(delta)
              ).toFixed(2)}{" "}
              {unit}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete entry"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function formatHistoryDate(iso: string, tz: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startToday = startOfDayInTz(tz, now);
  const startYesterday = new Date(startToday.getTime() - 24 * 60 * 60 * 1000);

  if (date >= startToday) return "Today";
  if (date >= startYesterday) return "Yesterday";

  const daysAgo = Math.floor(
    (startToday.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysAgo < 7) {
    return date.toLocaleDateString("en-US", { timeZone: tz, weekday: "long" });
  }
  return date.toLocaleDateString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    year: getYearInTz(date, tz) !== getYearInTz(now, tz) ? "numeric" : undefined,
  });
}

function getYearInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
  }).formatToParts(date);
  return parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
