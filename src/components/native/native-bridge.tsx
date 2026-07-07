"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { isNative, nativePlatform } from "@/lib/native";

// Single client-side coordinator for the Capacitor native shell. Mounted once
// in the root layout; its entire body no-ops on web (guarded by isNative), so
// the plugin code is dynamically imported — web users never download it.
//
// Responsibilities:
//   • Splash: hide it once the WebView has painted (auto-hide is disabled in
//     capacitor.config so it can't flash to a blank screen mid-load).
//   • Status bar: edge-to-edge, icon contrast kept in sync with the theme.
//   • Android back button: history-back, with double-tap-to-exit at the root.
//   • Keyboard: resize the WebView so focused inputs stay visible.
//   • Network: show an offline banner when connectivity drops.
//   • External links: open non-kcals.app URLs in the system browser.
//   • Deep links: handle the kcals://auth-callback OAuth handoff.
//   • Push: request permission, register the FCM token, route notification taps.
export function NativeBridge({ authed }: { authed: boolean }) {
  const [offline, setOffline] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // Core native chrome — set up once on mount.
  useEffect(() => {
    if (!isNative()) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const showHint = (message: string, ms = 2000) => {
      setHint(message);
      window.setTimeout(() => setHint((h) => (h === message ? null : h)), ms);
    };

    (async () => {
      const [
        { SplashScreen },
        { StatusBar, Style },
        { App },
        { Network },
        { Browser },
        { Keyboard, KeyboardResize },
      ] = await Promise.all([
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/app"),
        import("@capacitor/network"),
        import("@capacitor/browser"),
        import("@capacitor/keyboard"),
      ]);
      if (cancelled) return;

      document.body.classList.add("native");

      await SplashScreen.hide().catch(() => {});

      // Draw under the status bar (safe-area CSS pads content back out) and
      // match icon contrast to the current theme. Style.Dark = light icons for
      // a dark background; Style.Light = dark icons for a light background.
      await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
      const syncStatusBar = () => {
        const dark = document.documentElement.classList.contains("dark");
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
          () => {}
        );
      };
      syncStatusBar();
      const themeObserver = new MutationObserver(syncStatusBar);
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      cleanups.push(() => themeObserver.disconnect());

      Keyboard.setResizeMode({ mode: KeyboardResize.Native }).catch(() => {});

      // Android hardware back → WebView history; double-tap to exit at the root.
      let lastBackAt = 0;
      const backHandle = await App.addListener(
        "backButton",
        ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
            return;
          }
          const now = Date.now();
          if (now - lastBackAt < 2000) {
            App.exitApp();
          } else {
            lastBackAt = now;
            showHint("Press back again to exit");
          }
        }
      );
      cleanups.push(() => void backHandle.remove());

      // Offline banner.
      const status = await Network.getStatus();
      if (!cancelled) setOffline(!status.connected);
      const netHandle = await Network.addListener(
        "networkStatusChange",
        (s) => setOffline(!s.connected)
      );
      cleanups.push(() => void netHandle.remove());

      // OAuth handoff: kcals://auth-callback?code=… relaunches the app after
      // sign-in completes in the system browser. Close the browser and do a
      // full navigation to /consume so its Set-Cookie establishes the session.
      const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return;
        }
        if (parsed.protocol === "kcals:" && parsed.host === "auth-callback") {
          const code = parsed.searchParams.get("code");
          Browser.close().catch(() => {});
          if (code) {
            window.location.href = `/native/auth/consume?code=${encodeURIComponent(
              code
            )}`;
          }
        }
      });
      cleanups.push(() => void urlHandle.remove());

      // External links open in the system browser instead of trapping the
      // WebView on a page it can't navigate back from.
      const onClick = (e: MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0) return;
        const anchor = (e.target as HTMLElement | null)?.closest?.("a");
        const href = anchor?.getAttribute("href");
        if (!href) return;
        let dest: URL;
        try {
          dest = new URL(href, window.location.href);
        } catch {
          return;
        }
        if (
          /^https?:$/.test(dest.protocol) &&
          dest.origin !== window.location.origin
        ) {
          e.preventDefault();
          Browser.open({ url: dest.href }).catch(() => {});
        }
      };
      document.addEventListener("click", onClick, true);
      cleanups.push(() => document.removeEventListener("click", onClick, true));
    })();

    return () => {
      cancelled = true;
      document.body.classList.remove("native");
      cleanups.forEach((fn) => fn());
    };
  }, []);

  // Push notifications — only once we have a signed-in user to attach the
  // device token to. Re-runs when auth state flips (e.g. after the handoff).
  useEffect(() => {
    if (!isNative() || !authed) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      const perm = await PushNotifications.requestPermissions();
      if (cancelled || perm.receive !== "granted") return;

      const regHandle = await PushNotifications.addListener(
        "registration",
        (token) => {
          fetch("/api/push/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: token.value,
              platform: nativePlatform(),
            }),
            keepalive: true,
          }).catch(() => {});
        }
      );
      cleanups.push(() => void regHandle.remove());

      // Tapping a notification deep-links to the screen it points at.
      const tapHandle = await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const url = action.notification.data?.url;
          if (typeof url === "string" && url.startsWith("/")) {
            window.location.href = url;
          }
        }
      );
      cleanups.push(() => void tapHandle.remove());

      await PushNotifications.register().catch(() => {});
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [authed]);

  return (
    <>
      {offline && (
        <div className="native-toast pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/95 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-card-lg backdrop-blur">
            <WifiOff className="h-3.5 w-3.5" />
            You&apos;re offline
          </span>
        </div>
      )}
      {hint && (
        <div className="native-toast pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <span className="inline-flex items-center rounded-full bg-foreground/90 px-4 py-2 text-xs font-medium text-background shadow-card-lg">
            {hint}
          </span>
        </div>
      )}
    </>
  );
}
