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

// In remote-URL Capacitor mode the native bridge (window.androidBridge — what
// isNativePlatform() keys off) can be injected a beat AFTER the web app
// hydrates, especially on a full-page navigation. A one-shot isNative() at mount
// then wrongly reads "web" and every native feature stays off for the whole
// page. whenNativeReady() resolves true as soon as the bridge appears (polling
// briefly) or false if it never does (real web / PWA) — so native-only code can
// wait for the bridge instead of giving up at mount. This was the root cause of
// the Health-Connect "isNative=false" saga.
const POLL_MS = 100;
const MAX_WAIT_MS = 3000;
let readyPromise: Promise<boolean> | null = null;

export function whenNativeReady(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (isNative()) return Promise.resolve(true);
  if (readyPromise) return readyPromise;
  readyPromise = new Promise<boolean>((resolve) => {
    let waited = 0;
    const id = window.setInterval(() => {
      if (isNative()) {
        window.clearInterval(id);
        resolve(true);
      } else if ((waited += POLL_MS) >= MAX_WAIT_MS) {
        window.clearInterval(id);
        resolve(false);
      }
    }, POLL_MS);
  });
  return readyPromise;
}
