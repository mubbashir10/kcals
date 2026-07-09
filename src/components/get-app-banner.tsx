"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";

import { isNative } from "@/lib/native";
import { useNativeReady } from "@/lib/use-native";

const DISMISS_KEY = "kcals.getapp-dismissed";

// Only nudge people who'd actually benefit: Android, in a real browser (not the
// native shell, not an already-installed PWA), off the pages that already link
// to /install, and not after they've dismissed it.
function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  if (isNative()) return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return false;
  if ((navigator as Navigator & { standalone?: boolean }).standalone) {
    return false;
  }
  if (!/Android/i.test(navigator.userAgent)) return false;
  const path = window.location.pathname;
  if (path === "/signin" || path.startsWith("/install")) return false;
  try {
    if (localStorage.getItem(DISMISS_KEY)) return false;
  } catch {
    // localStorage blocked — err on showing it.
  }
  return true;
}

// Eligibility is derived from user-agent / display-mode / storage, which don't
// change during a session — so a no-op subscription + null server snapshot lets
// us compute it client-side without a setState-in-effect.
const noSubscribe = () => () => {};

// Subtle bottom banner pointing web users at the native Android app.
export function GetAppBanner() {
  // If the Capacitor bridge injects late, this flips true and hides the banner —
  // so the native app never shows a "get the app" nudge to itself.
  const native = useNativeReady();
  const eligible = useSyncExternalStore(noSubscribe, shouldShow, () => false);
  const [dismissed, setDismissed] = useState(false);

  if (native || !eligible || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border/60 bg-card/95 px-4 py-2.5 shadow-card-lg backdrop-blur">
        <div className="min-w-0 flex-1 text-xs leading-tight">
          <p className="font-medium">Get the kcals app</p>
          <p className="truncate text-muted-foreground">
            Reminders, activity sync &amp; a faster, full-screen experience.
          </p>
        </div>
        <a
          href="/install"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-b from-lime-400 to-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-emerald-950 shadow-card transition-transform active:translate-y-px"
        >
          <Download className="h-3 w-3" />
          Get app
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
