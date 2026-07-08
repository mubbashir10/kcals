"use client";

import { useEffect } from "react";

// TEMP recovery: the previous caching service worker was serving a stale app
// shell — inside the Capacitor native WebView that also bypassed the native
// bridge, so `isNative()` stayed false and every native feature was off. Until
// we ship a native-safe, network-first SW, this actively unregisters any
// existing service worker instead of registering one. (The kill-switch
// public/sw.js also self-unregisters + clears caches when it activates.)
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((reg) => reg.unregister()))
      .catch(() => {
        // Non-fatal — nothing to clean up.
      });
  }, []);

  return null;
}
