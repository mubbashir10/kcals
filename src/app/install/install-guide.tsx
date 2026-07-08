"use client";

import { useSyncExternalStore } from "react";
import { Download, Share, Smartphone } from "lucide-react";

type Platform = "android" | "ios" | "desktop";

function detect(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && "ontouchend" in document)
  ) {
    return "ios";
  }
  return "desktop";
}

const noSub = () => () => {};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">
        {n}
      </span>
      <span className="flex-1 pt-0.5">{children}</span>
    </li>
  );
}

export function InstallGuide() {
  // Platform is stable for the session; SSR renders null to avoid a mismatch.
  const platform = useSyncExternalStore(noSub, detect, () => null);

  if (platform === null) return null;

  if (platform === "android") {
    return (
      <div className="space-y-6">
        <a
          href="/download"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-b from-lime-400 to-emerald-500 text-sm font-semibold text-emerald-950 shadow-card-lg transition-transform active:translate-y-px"
        >
          <Download className="h-4 w-4" />
          Download for Android
        </a>
        <ol className="space-y-3 text-sm">
          <Step n={1}>Tap the button above to download the app.</Step>
          <Step n={2}>
            Open the downloaded file (tap the download notification, or find{" "}
            <span className="font-medium">kcals.apk</span> in your files).
          </Step>
          <Step n={3}>
            When Android asks, allow{" "}
            <span className="font-medium">
              installing apps from this source
            </span>{" "}
            (this is normal for apps outside the Play Store).
          </Step>
          <Step n={4}>Open kcals and sign in with Google.</Step>
        </ol>
        <p className="text-xs leading-relaxed text-muted-foreground/70">
          Already have the old &ldquo;kcals&rdquo; shortcut installed? Uninstall
          it first — this is the real app (with reminders and activity sync).
          The web version at kcals.app keeps working in your browser regardless.
        </p>
      </div>
    );
  }

  if (platform === "ios") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Smartphone className="h-4 w-4 text-emerald-500" />
          Add kcals to your Home Screen
        </div>
        <p className="text-xs text-muted-foreground">
          The native app is Android-only for now, but on iPhone you can install
          the web app — it opens full-screen like a real app.
        </p>
        <ol className="space-y-3 text-sm">
          <Step n={1}>
            In <span className="font-medium">Safari</span>, tap the{" "}
            <Share className="inline-block h-4 w-4 align-text-bottom" /> Share
            button.
          </Step>
          <Step n={2}>
            Scroll and tap{" "}
            <span className="font-medium">Add to Home Screen</span>, then{" "}
            <span className="font-medium">Add</span>.
          </Step>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p>
        The kcals app is for <span className="text-foreground">Android</span>.
        Open this page on your Android phone to install it:
      </p>
      <p className="rounded-xl border border-border/60 bg-card px-4 py-3 text-center font-mono text-foreground">
        kcals.app/install
      </p>
      <p className="text-xs text-muted-foreground/70">
        On a computer or iPhone you can just use kcals.app in your browser.
      </p>
    </div>
  );
}
