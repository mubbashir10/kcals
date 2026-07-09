"use client";

import { Activity, Flame, Footprints } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useNativeReady } from "@/lib/use-native";
import { metricColor } from "@/lib/metric-colors";

// Native-only Health Connect status. The Android app reads Health Connect in
// NATIVE code (see MainActivity.kt) and syncs today's steps + active calories to
// the account on every launch, so there's nothing to toggle. Shows today's
// synced numbers when we have them. Renders nothing on web/PWA.
export function HealthConnectSettings({
  steps,
  activeKcal,
}: {
  steps: number | null;
  activeKcal: number | null;
}) {
  const native = useNativeReady();
  if (!native) return null;

  const hasData = (activeKcal ?? 0) > 0 || (steps ?? 0) > 0;

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Health Connect</span>
      </div>

      {hasData && (
        <div className="mb-3 flex items-center gap-5 rounded-2xl bg-muted/50 px-4 py-3">
          <div className="flex items-baseline gap-1.5">
            <Flame
              className="h-4 w-4 shrink-0 translate-y-0.5"
              style={{ color: metricColor.energy }}
            />
            <span className="text-base font-semibold tabular-nums">
              {(activeKcal ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">kcal</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <Footprints
              className="h-4 w-4 shrink-0 translate-y-0.5"
              style={{ color: metricColor.activity }}
            />
            <span className="text-base font-semibold tabular-nums">
              {(steps ?? 0).toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">steps</span>
          </div>
          <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            today
          </span>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Your band&apos;s steps and active calories — de-duped across trackers —
        sync automatically from Health Connect each time you open the app, so
        your TDEE updates without manual entry. Manage access in your phone&apos;s
        Health Connect settings.
      </p>
    </Card>
  );
}
