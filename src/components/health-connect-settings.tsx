"use client";

import { Activity } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useNativeReady } from "@/lib/use-native";

// Native-only note. The Android app reads Health Connect in NATIVE code (see
// MainActivity.kt) and syncs today's steps + active calories to the account on
// every launch — so there's nothing to toggle here. (The old in-WebView plugin
// path was unreliable and has been removed.) Renders nothing on web/PWA.
export function HealthConnectSettings() {
  const native = useNativeReady();
  if (!native) return null;

  return (
    <Card className="rounded-2xl border-border/60 p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Health Connect</span>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Your band&apos;s steps and active calories — de-duped across trackers —
        sync automatically from Health Connect each time you open the app, so
        your TDEE updates without manual entry. Manage access in your phone&apos;s
        Health Connect settings.
      </p>
    </Card>
  );
}
