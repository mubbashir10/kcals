"use client";

import { useEffect, useState } from "react";

// TEMP diagnostic: prints whether the Capacitor native bridge is present in the
// WebView. Rendered on the sign-in page so it's reachable without a session
// (after a full app-data clear). Remove once the native bridge is fixed.
export function BridgeStatus() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    const cap = (
      window as unknown as {
        Capacitor?: {
          getPlatform?: () => string;
          isNativePlatform?: () => boolean;
        };
      }
    ).Capacitor;
    setStatus(
      `window.Capacitor=${cap ? "PRESENT" : "MISSING"} · ` +
        `platform=${cap?.getPlatform?.() ?? "?"} · ` +
        `isNative=${String(cap?.isNativePlatform?.() ?? "?")} · ` +
        `SW=${navigator.serviceWorker?.controller ? "on" : "off"}`
    );
  }, []);

  return (
    <p className="mt-4 max-w-[22rem] break-all text-center text-[10px] leading-relaxed text-muted-foreground/60">
      {status}
    </p>
  );
}
