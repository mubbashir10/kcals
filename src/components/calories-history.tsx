import { ChevronRight, Infinity as InfinityIcon } from "lucide-react";

import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { startOfDayInTz } from "@/lib/clock";
import type { MacroGoal, MacroGoals } from "@/lib/macros";

// Match the dots used in MacrosWidget so the same macro reads the same color
// everywhere.
const ACCENTS = {
  protein: "oklch(0.68 0.2 20)",
  carbs: "oklch(0.78 0.16 75)",
  fat: "oklch(0.6 0.18 280)",
} as const;

export type CaloriesHistoryEntry = {
  dayKey: string;
  consumed: { kcal: number; protein: number; carbs: number; fat: number };
  calorieGoal: number;
  macroGoals: MacroGoals;
};

export function CaloriesHistory({
  entries,
  timezone,
}: {
  entries: CaloriesHistoryEntry[];
  timezone: string;
}) {
  if (entries.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed border-border/60 bg-card/40 px-6 py-10 text-center shadow-none">
        <p className="text-sm text-muted-foreground">No daily totals yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 p-0 shadow-card">
      <ul className="divide-y divide-border/60">
        {entries.map((entry) => (
          <CaloriesHistoryRow
            key={entry.dayKey}
            entry={entry}
            timezone={timezone}
          />
        ))}
      </ul>
    </Card>
  );
}

function CaloriesHistoryRow({
  entry,
  timezone,
}: {
  entry: CaloriesHistoryEntry;
  timezone: string;
}) {
  const consumed = Math.round(entry.consumed.kcal);
  const goal = entry.calorieGoal;
  const delta = consumed - goal;
  const overGoal = delta > 0;
  const empty = consumed === 0;

  const dateStr = formatHistoryDate(entry.dayKey, timezone);

  return (
    <li>
      <AppLink
        href={`/day/${entry.dayKey}`}
        className="group flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{dateStr}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            <Macro
              label="P"
              accent={ACCENTS.protein}
              value={Math.round(entry.consumed.protein)}
              goal={entry.macroGoals.protein}
            />
            <Macro
              label="C"
              accent={ACCENTS.carbs}
              value={Math.round(entry.consumed.carbs)}
              goal={entry.macroGoals.carbs}
            />
            <Macro
              label="F"
              accent={ACCENTS.fat}
              value={Math.round(entry.consumed.fat)}
              goal={entry.macroGoals.fat}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {empty ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <>
                  {consumed.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    / {goal.toLocaleString()}
                  </span>
                </>
              )}
            </div>
            {!empty && Math.abs(delta) >= 1 && (
              <div
                className={cn(
                  "text-[10px] font-medium tabular-nums",
                  overGoal ? "text-rose-500" : "text-emerald-500"
                )}
              >
                {overGoal ? "+" : "−"}
                {Math.abs(delta).toLocaleString()} kcal
              </div>
            )}
          </div>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
        </div>
      </AppLink>
    </li>
  );
}

function Macro({
  label,
  accent,
  value,
  goal,
}: {
  label: string;
  accent: string;
  value: number;
  goal: MacroGoal;
}) {
  const tracked = goal.kind !== "off";
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="h-1 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="font-medium uppercase tracking-[0.14em]">{label}</span>
      <span className="font-semibold text-foreground/80">{value}</span>
      {tracked ? (
        <span className="text-muted-foreground/60">/{goal.g}</span>
      ) : (
        <span className="inline-flex items-center text-muted-foreground/50">
          /<InfinityIcon className="ml-0.5 h-2.5 w-2.5" aria-label="not tracked" />
        </span>
      )}
    </span>
  );
}

// "Today" / "Yesterday" / weekday for the past week, otherwise short date.
function formatHistoryDate(dayKey: string, tz: string): string {
  const [y, m, d] = dayKey.split("-").map((s) => parseInt(s, 10));
  // Use noon UTC so toLocaleDateString in the user's tz lands on the right day.
  const date = new Date(Date.UTC(y, m - 1, d, 12));

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
    year:
      getYearInTz(date, tz) !== getYearInTz(now, tz) ? "numeric" : undefined,
  });
}

function getYearInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
  }).formatToParts(date);
  return parseInt(parts.find((p) => p.type === "year")?.value ?? "0", 10);
}
