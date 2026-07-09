"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Activity, Flame, Footprints, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useNativeReady } from "@/lib/use-native";
import { metricColor } from "@/lib/metric-colors";
import { setHealthSync } from "@/app/actions/health";

// window.KcalsNative is a direct JS interface added by MainActivity.kt (not the
// Capacitor plugin layer). syncHealth() re-reads Health Connect on demand;
// requestHealthPermission() forces the system permission sheet even if we
// already asked this launch.
type KcalsNativeWindow = Window & {
  KcalsNative?: {
    syncHealth?: () => void;
    requestHealthPermission?: () => void;
  };
};

// Native-only Health Connect control. The Android app reads Health Connect in
// native code (MainActivity.kt) and syncs the last week of steps + active
// calories on every launch; "Sync now" forces a fresh read. Renders nothing on
// web/PWA.
export function HealthConnectSettings({
  enabled: initialEnabled,
  steps,
  activeKcal,
}: {
  enabled: boolean;
  steps: number | null;
  activeKcal: number | null;
}) {
  const native = useNativeReady();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [syncing, setSyncing] = useState(false);
  const [, startTransition] = useTransition();
  const spinnerTimeout = useRef<number | undefined>(undefined);

  // Whether the native sync interface is present (v1.6+ APK). Derived from a
  // snapshot so we never setState-in-effect. `subscribe` is a no-op because
  // addJavascriptInterface runs before the page loads — unlike the Capacitor
  // bridge, KcalsNative is never injected late.
  const bridge = useSyncExternalStore(
    () => () => {},
    () => typeof (window as KcalsNativeWindow).KcalsNative?.syncHealth === "function",
    () => false
  );

  const stopSpinner = () => {
    window.clearTimeout(spinnerTimeout.current);
    setSyncing(false);
  };

  useEffect(() => {
    // The native sync finished (re-fetch already triggered by native-bridge) —
    // drop the spinner. setState here runs in the event callback, not the effect
    // body, which is fine.
    const done = () => stopSpinner();
    window.addEventListener("kcals:health-synced", done);
    return () => {
      window.removeEventListener("kcals:health-synced", done);
      window.clearTimeout(spinnerTimeout.current);
    };
  }, []);

  if (!native) return null;

  const hasData = (activeKcal ?? 0) > 0 || (steps ?? 0) > 0;

  const runSync = (force: boolean) => {
    const api = (window as KcalsNativeWindow).KcalsNative;
    if (!api?.syncHealth) return;
    setSyncing(true);
    // Enabling should surface the system permission sheet even if we already
    // asked (and were dismissed) earlier this launch.
    if (force && api.requestHealthPermission) api.requestHealthPermission();
    else api.syncHealth();
    // Fallback in case no sync event arrives (e.g. nothing to read).
    window.clearTimeout(spinnerTimeout.current);
    spinnerTimeout.current = window.setTimeout(stopSpinner, 8000);
  };

  const toggle = () => {
    const next = !enabled;
    setEnabled(next); // optimistic — feels instant
    if (!next) stopSpinner();
    startTransition(async () => {
      try {
        await setHealthSync(next);
      } catch {
        setEnabled(!next); // server never heard us — don't lie about the state
        return;
      }
      // Only after the server knows: the shell asks it before reading, so a
      // sync fired any earlier would see the old value.
      if (next) runSync(true);
    });
  };

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Health Connect</span>
        </div>
        <div className="flex items-center gap-2">
          {enabled && bridge && (
            <Button
              type="button"
              onClick={() => runSync(false)}
              disabled={syncing}
              variant="secondary"
              size="sm"
              className="shrink-0 rounded-full"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Sync from Health Connect"
            onClick={toggle}
            className={cn(
              "relative h-6 w-10 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
              enabled ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-[left]",
                enabled ? "left-[18px]" : "left-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {enabled && hasData && (
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
        {enabled ? (
          <>
            Your band&apos;s steps and active calories — de-duped across trackers
            — sync automatically each time you open the app. The last week is
            re-read every time, so a day you closed the app early still picks up
            its full total. Days you log by hand are left alone; clear the log to
            hand one back.
          </>
        ) : (
          <>
            Off — the app won&apos;t read Health Connect or ask for permission.
            Log your activity by hand instead. Turning it back on re-syncs the
            last week.
          </>
        )}
      </p>
    </Card>
  );
}
