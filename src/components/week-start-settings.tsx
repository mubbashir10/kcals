"use client";

import { useState, useTransition } from "react";
import { CalendarRange } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setWeekStartDay } from "@/app/actions/widgets";

// 0=Sunday … 6=Saturday (JS getUTCDay convention, matches lib/week.ts).
const DAYS: { value: number; short: string; full: string }[] = [
  { value: 0, short: "Su", full: "Sunday" },
  { value: 1, short: "Mo", full: "Monday" },
  { value: 2, short: "Tu", full: "Tuesday" },
  { value: 3, short: "We", full: "Wednesday" },
  { value: 4, short: "Th", full: "Thursday" },
  { value: 5, short: "Fr", full: "Friday" },
  { value: 6, short: "Sa", full: "Saturday" },
];

export function WeekStartSettings({ initial }: { initial: number }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function set(next: number) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await setWeekStartDay(next);
      } catch {
        setValue(prev);
      }
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Week starts on</span>
      </div>
      <div
        className={cn(
          "flex w-full gap-1",
          pending && "opacity-60"
        )}
      >
        {DAYS.map(({ value: v, short, full }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => set(v)}
              disabled={pending}
              aria-label={full}
              aria-pressed={active}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] font-medium tabular-nums transition-all",
                active
                  ? "bg-foreground text-background shadow-card"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {short}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Sets the 7-day span on your{" "}
        <span className="text-foreground/70">week summary</span>.
      </p>
    </Card>
  );
}
