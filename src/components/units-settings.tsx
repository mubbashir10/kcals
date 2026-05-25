"use client";

import { useTransition } from "react";
import { Ruler } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { setUnits } from "@/app/actions/widgets";
import type { UnitsPreference } from "@/lib/widget-order";

const UNITS: { value: UnitsPreference; label: string; hint: string }[] = [
  { value: "metric", label: "Metric", hint: "kg · cm" },
  { value: "imperial", label: "Imperial", hint: "lb · ft/in" },
];

export function UnitsSettings({ initial }: { initial: UnitsPreference }) {
  const [pending, startTransition] = useTransition();

  function set(next: UnitsPreference) {
    if (next === initial) return;
    startTransition(async () => {
      await setUnits(next);
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Units</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          Everywhere
        </span>
      </div>
      <div
        className={cn(
          "inline-flex w-full rounded-full bg-muted p-1",
          pending && "opacity-60"
        )}
      >
        {UNITS.map(({ value, label, hint }) => {
          const active = initial === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => set(value)}
              disabled={pending}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "text-[9px] font-normal uppercase tracking-wider",
                  active ? "text-muted-foreground" : "text-muted-foreground/70"
                )}
              >
                {hint}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
