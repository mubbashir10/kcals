"use client";

import { useEffect, useState } from "react";
import { Flame, Footprints } from "lucide-react";

import { isNative } from "@/lib/native";
import {
  hasHealthAccess,
  readTodayActivity,
  type TodayActivity,
} from "@/lib/health";

// Live "so far today" movement, straight from Health Connect (de-duped across
// trackers): active calories burned + steps. Native-only, and only once the
// user has connected Health Connect; re-reads when the app returns to the
// foreground. Renders nothing on web or when there's no data.
export function HealthTodayStats() {
  const [data, setData] = useState<TodayActivity | null>(null);

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    const load = async () => {
      if (!(await hasHealthAccess())) return;
      const next = await readTodayActivity();
      if (!cancelled) setData(next);
    };

    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!data || (data.activeKcal == null && data.steps == null)) return null;

  return (
    <div className="mb-3 flex items-center gap-5 rounded-2xl bg-muted/50 px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <Flame className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground" />
        <span className="text-base font-semibold tabular-nums">
          {(data.activeKcal ?? 0).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">kcal</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <Footprints className="h-4 w-4 shrink-0 translate-y-0.5 text-muted-foreground" />
        <span className="text-base font-semibold tabular-nums">
          {(data.steps ?? 0).toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">steps</span>
      </div>
      <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        so far
      </span>
    </div>
  );
}
