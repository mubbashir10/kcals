"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Activity, Flame, Footprints, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNativeReady } from "@/lib/use-native";
import { metricColor } from "@/lib/metric-colors";

// window.KcalsNative is a direct JS interface added by MainActivity.kt (not the
// Capacitor plugin layer). syncHealth() re-reads Health Connect on demand; the
// native side then fires "kcals:health-synced" and the app re-fetches.
type KcalsNativeWindow = Window & {
  KcalsNative?: { syncHealth?: () => void };
};

// Native-only Health Connect status. The Android app reads Health Connect in
// native code (MainActivity.kt) and syncs today's steps + active calories to the
// account automatically on every launch; "Sync now" forces a fresh read. Renders
// nothing on web/PWA.
export function HealthConnectSettings({
  steps,
  activeKcal,
}: {
  steps: number | null;
  activeKcal: number | null;
}) {
  const native = useNativeReady();
  const [syncing, setSyncing] = useState(false);

  // Whether the native sync interface is present (v1.6+ APK). Derived from a
  // snapshot so we never setState-in-effect.
  const canSync = useSyncExternalStore(
    () => () => {},
    () =>
      typeof (window as KcalsNativeWindow).KcalsNative?.syncHealth === "function",
    () => false
  );

  useEffect(() => {
    // The native sync finished (re-fetch already triggered by native-bridge) —
    // drop the spinner. setState here runs in the event callback, not the effect
    // body, which is fine.
    const done = () => setSyncing(false);
    window.addEventListener("kcals:health-synced", done);
    return () => window.removeEventListener("kcals:health-synced", done);
  }, []);

  if (!native) return null;

  const hasData = (activeKcal ?? 0) > 0 || (steps ?? 0) > 0;

  const syncNow = () => {
    const bridge = (window as KcalsNativeWindow).KcalsNative;
    if (!bridge?.syncHealth) return;
    setSyncing(true);
    bridge.syncHealth();
    // Fallback in case no sync event arrives (e.g. nothing to read).
    window.setTimeout(() => setSyncing(false), 8000);
  };

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Health Connect</span>
        </div>
        {canSync && (
          <Button
            type="button"
            onClick={syncNow}
            disabled={syncing}
            variant="secondary"
            size="sm"
            className="shrink-0 rounded-full"
          >
            <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        )}
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
