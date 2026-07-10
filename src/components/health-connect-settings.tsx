"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { Activity, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { kcalsNative } from "@/lib/native";
import { cn } from "@/lib/utils";
import { useNativeReady } from "@/lib/use-native";
import { setHealthSync } from "@/app/actions/health";

// Native-only Health Connect control: a switch and a manual sync, nothing more.
// The numbers it pulls in belong on the dashboard, not in settings. Renders
// nothing on web/PWA.
export function HealthConnectSettings({ enabled: initialEnabled }: { enabled: boolean }) {
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
    () => typeof kcalsNative()?.syncHealth === "function",
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

  const runSync = (force: boolean) => {
    const api = kcalsNative();
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
      <div className="flex items-center justify-between gap-2">
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
            aria-label="Sync with Health Connect"
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

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
        {enabled ? (
          <>
            Steps and active calories — de-duped across trackers — sync in each
            time you open the app, re-reading the last week so a day you closed
            the app early still picks up its full total; days you log by hand
            are left alone. Weight syncs both ways: every weigh-in you log here
            (history included) lands in Health Connect, and weigh-ins, height,
            or body fat recorded by other apps flow back in.
          </>
        ) : (
          <>
            Off — the app won&apos;t read or write Health Connect, or ask for
            permission. Log your activity and weight by hand instead. Turning
            it back on re-syncs everything.
          </>
        )}
      </p>
    </Card>
  );
}
