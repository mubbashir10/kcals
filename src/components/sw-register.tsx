"use client";

import { useEffect } from "react";

// Registers the service worker that backs the PWA: caches static assets and
// RSC payloads so repeat navigations render instantly from local cache and
// then revalidate in the background.
//
// Disabled in dev — the HMR socket and Turbopack's chunk URLs play badly
// with a SW that tries to cache them, and the perceived-perf win only
// matters in prod anyway.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failures are non-fatal — the app still works,
        // just without the offline cache.
      });
  }, []);

  return null;
}
