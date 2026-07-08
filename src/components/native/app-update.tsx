"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, X } from "lucide-react";

import { isNative } from "@/lib/native";

const DISMISS_KEY = "kcals.update-dismissed"; // stores the dismissed versionCode

// In-app update prompt for the sideloaded Android app. On launch it compares
// the installed build to the latest published one (/api/app-version); if a
// newer APK exists it offers a one-tap download. Installing over the top
// updates in place (same signing key) — no uninstall, data preserved. Web/
// feature changes don't need this: they arrive automatically on each deploy.
export function AppUpdate() {
  const [latest, setLatest] = useState<{ code: number; name: string } | null>(
    null
  );

  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const installed = parseInt(info.build, 10) || 0;

        const res = await fetch("/api/app-version", { cache: "no-store" });
        const data = await res.json();
        const code = Number(data?.code) || 0;
        if (cancelled) return;

        let dismissed = 0;
        try {
          dismissed = Number(localStorage.getItem(DISMISS_KEY)) || 0;
        } catch {
          // ignore
        }

        if (code > installed && code > dismissed) {
          setLatest({ code, name: String(data?.name ?? "") });
        }
      } catch {
        // Offline / error — just don't prompt this launch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!latest) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(latest.code));
    } catch {
      // ignore
    }
    setLatest(null);
  };

  const update = () => {
    import("@capacitor/browser")
      .then(({ Browser }) =>
        Browser.open({ url: `${window.location.origin}/download` })
      )
      .catch(() => {});
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-500/30 bg-card/95 px-4 py-2.5 shadow-card-lg backdrop-blur">
        <ArrowUpCircle className="h-5 w-5 shrink-0 text-emerald-500" />
        <div className="min-w-0 flex-1 text-xs leading-tight">
          <p className="font-medium">Update available</p>
          <p className="truncate text-muted-foreground">
            A newer version of kcals is ready — installs over the current one.
          </p>
        </div>
        <button
          type="button"
          onClick={update}
          className="inline-flex shrink-0 items-center rounded-full bg-gradient-to-b from-lime-400 to-emerald-500 px-3.5 py-1.5 text-[11px] font-semibold text-emerald-950 shadow-card transition-transform active:translate-y-px"
        >
          Update
        </button>
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
