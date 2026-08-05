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

// The Android shell exposes window.KcalsNative — a direct JS interface added
// in MainActivity.kt (the reliable low-level primitive, NOT the Capacitor
// plugin layer). Every method is optional: older APKs miss the newer ones.
export type KcalsNative = {
  /** Full Health Connect pass: activity + measurements. May prompt. (v1.6+) */
  syncHealth?: () => void;
  /** Force the permission sheet even if already asked this launch. (v1.6+) */
  requestHealthPermission?: () => void;
  /** Measurements-only pass; never prompts. (v1.9+) */
  syncMeasurements?: () => void;
};

/** The native interface, or undefined on web/PWA/server. */
export function kcalsNative(): KcalsNative | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { KcalsNative?: KcalsNative }).KcalsNative;
}

// A short buzz under the finger, for the moment a gesture commits (a pull
// passing the refresh threshold, a press-and-hold latching on). Fire-and-forget
// and safe to call from any handler: the plugin is only imported inside the
// native shell, so web/PWA users pay nothing and feel nothing.
export function hapticTap(style: "light" | "medium" = "light") {
  if (!isNative()) return;
  import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle }) =>
      Haptics.impact({
        style: style === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
      })
    )
    .catch(() => {});
}

// Push a just-logged weigh-in / profile change to Health Connect immediately
// instead of waiting for the next app open. Fire-and-forget and safe to call
// from any mutation handler: no-ops on web/PWA and on APKs older than v1.9.
export function nudgeMeasurementSync() {
  try {
    kcalsNative()?.syncMeasurements?.();
  } catch {
    // Native side gone mid-call — nothing to do, the next launch syncs.
  }
}

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
