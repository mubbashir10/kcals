"use client";

import { useEffect, useState } from "react";

import { whenNativeReady } from "@/lib/native";

// Subtle build identifier — the live web build's short commit SHA, plus the
// installed native app version when running in the Capacitor shell. Makes it
// obvious at a glance which web bundle + APK are actually loaded.
export function VersionBadge() {
  const web = process.env.NEXT_PUBLIC_BUILD_SHA ?? "local";
  const [app, setApp] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!(await whenNativeReady())) return; // web/PWA: no native version
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (alive) setApp(`${info.version} (${info.build})`);
      } catch {
        // native version unavailable — just show the web build
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <p className="mt-10 text-center text-[10px] tabular-nums text-muted-foreground/50">
      kcals · web {web}
      {app ? ` · app ${app}` : ""}
    </p>
  );
}
