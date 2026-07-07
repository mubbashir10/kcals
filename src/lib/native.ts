import { Capacitor } from "@capacitor/core";

// Helpers for detecting the Capacitor native shell. Client-only in practice —
// only call these from client components. On the server (or in a plain
// browser/PWA) `isNativePlatform()` returns false, so every guarded branch
// safely no-ops for web users.

/** True when running inside the Capacitor Android app (not a browser/PWA). */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** "android" | "ios" | "web" — the runtime the app is executing in. */
export function nativePlatform(): string {
  return Capacitor.getPlatform();
}
