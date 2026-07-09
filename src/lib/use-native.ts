"use client";

import { useEffect, useState } from "react";

import { isNative, whenNativeReady } from "@/lib/native";

// Reactive isNative(): starts from the synchronous check, then flips to true if
// the Capacitor bridge injects late (see whenNativeReady in native.ts). Lets
// native-only UI enable itself once the bridge is up instead of deciding "web"
// at mount and staying off for the whole page. Returns false on the web/PWA.
export function useNativeReady(): boolean {
  const [native, setNative] = useState(() =>
    typeof window !== "undefined" ? isNative() : false
  );

  useEffect(() => {
    if (native) return; // already native — nothing to wait for
    let alive = true;
    whenNativeReady().then((v) => {
      if (alive) setNative(v);
    });
    return () => {
      alive = false;
    };
  }, [native]);

  return native;
}
