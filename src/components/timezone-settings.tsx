"use client";

import { useState, useTransition } from "react";
import { Clock } from "lucide-react";

import { Card } from "@/components/ui/card";
import { TimezonePicker } from "@/components/timezone-picker";
import { setTimezone } from "@/app/actions/widgets";

export function TimezoneSettings({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    if (next === value) return;
    const prev = value;
    setValue(next);
    startTransition(async () => {
      try {
        await setTimezone(next);
      } catch {
        // Roll back on failure so the picker reflects what the server has.
        setValue(prev);
      }
    });
  }

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Timezone</span>
      </div>
      <TimezonePicker value={value} onChange={onChange} disabled={pending} />
      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Every &ldquo;today&rdquo; in the app — meals, greeting, time stamps —
        runs on this clock.
      </p>
    </Card>
  );
}
