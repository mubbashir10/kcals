"use client";

import { useEffect, useState, useTransition } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HealthDebugPanel } from "@/components/health-debug";
import { cn } from "@/lib/utils";
import { isNative } from "@/lib/native";
import {
  hasHealthAccess,
  healthAvailable,
  healthSyncEnabled,
  requestHealthAccess,
  setHealthSyncEnabled,
  syncHealthNow,
  type TodayActivity,
} from "@/lib/health";

// Native-only settings card: connect Health Connect so today's activity
// (de-duped steps + active calories from the band) auto-fills TDEE. Renders
// nothing on the web/PWA or where Health Connect isn't present.
export function HealthConnectSettings() {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [last, setLast] = useState<TodayActivity | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      const isApp = isNative();
      const avail = await healthAvailable();
      if (!alive) return;
      setNative(isApp);
      setAvailable(avail);
      setEnabled(healthSyncEnabled());
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Web/PWA: nothing to show. On native we always render — at least the
  // diagnostics — even when Health Connect isn't available, so the debug panel
  // isn't trapped behind the very thing it's meant to diagnose.
  if (!native) return null;
  if (available === null) return null;

  const sync = () =>
    startTransition(async () => {
      const data = await syncHealthNow();
      setLast(data);
      setMsg(data ? null : "No activity data yet today");
      if (data) router.refresh();
    });

  const toggle = () =>
    startTransition(async () => {
      setMsg(null);
      if (enabled) {
        setHealthSyncEnabled(false);
        setEnabled(false);
        setLast(null);
        return;
      }
      const ok = (await hasHealthAccess()) || (await requestHealthAccess());
      if (!ok) {
        setMsg("Allow Steps + Active calories in Health Connect to sync.");
        return;
      }
      setHealthSyncEnabled(true);
      setEnabled(true);
      const data = await syncHealthNow();
      setLast(data);
      if (data) router.refresh();
      else setMsg("Connected — no activity data yet today.");
    });

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">Health Connect</span>
        </div>
        {available && (
          <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={enabled}
            aria-label="Sync activity from Health Connect"
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-muted",
              pending && "opacity-60"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all",
                enabled ? "left-[22px]" : "left-0.5"
              )}
            />
          </button>
        )}
      </div>

      {available ? (
        <>
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            Auto-fill today&apos;s activity from your band — steps and active
            calories, de-duped across trackers — so your TDEE updates without
            manual entry.
          </p>

          {enabled && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {last
                  ? `Today · ${last.steps ?? "—"} steps · ${last.activeKcal ?? "—"} active kcal`
                  : "Pull today's activity"}
              </span>
              <Button
                type="button"
                onClick={sync}
                disabled={pending}
                variant="secondary"
                size="sm"
                className="shrink-0 rounded-full"
              >
                <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} />
                Sync now
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          Health Connect isn&apos;t available to the app yet — it may not be
          installed/set up on this phone, or this build predates the plugin. The
          diagnostics below show exactly what the app sees (including the
          installed version).
        </p>
      )}

      {msg && (
        <p className="mt-2 text-[11px] text-muted-foreground/70">{msg}</p>
      )}

      <HealthDebugPanel />
    </Card>
  );
}
