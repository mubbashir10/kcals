"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WifiOff } from "lucide-react";

import { nativePlatform, whenNativeReady } from "@/lib/native";
import { takeVerifier } from "@/lib/native-auth";

// Where we stash the FCM token client-side so it can be unregistered on
// sign-out (matters on shared devices — see the push effect).
const PUSH_TOKEN_KEY = "kcals.push-token";

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
export function NativeBridge() {
  const [offline, setOffline] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // Next's app-router instance is stable across renders, so the mount-once
  // effect below can depend on it without actually re-running.
  const router = useRouter();

  // A native Health Connect sync just landed — MainActivity fires this event via
  // evaluateJavascript after each successful POST. Re-fetch so today's steps +
  // active calories show without the user reopening the app. No-ops on web.
  useEffect(() => {
    const onSynced = () => router.refresh();
    window.addEventListener("kcals:health-synced", onSynced);
    return () => window.removeEventListener("kcals:health-synced", onSynced);
  }, [router]);

  // Core native chrome — set up once on mount.
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const showHint = (message: string, ms = 2000) => {
      setHint(message);
      window.setTimeout(() => setHint((h) => (h === message ? null : h)), ms);
    };

    (async () => {
      // In remote-URL mode the bridge can inject after we mount. Wait for it
      // rather than deciding "web" and turning every native feature off.
      if (!(await whenNativeReady()) || cancelled) return;
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

      // Keep the WebView BELOW the status bar (don't draw behind it): some
      // Android skins (e.g. MIUI) report env(safe-area-inset-top) as 0 under
      // overlay mode, which clipped the header logo/avatar. Match the bar to
      // the theme so it still looks seamless. Style.Dark = light icons for a
      // dark background; Style.Light = dark icons for a light background.
      await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      const syncStatusBar = () => {
        const dark = document.documentElement.classList.contains("dark");
        StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
          () => {}
        );
        StatusBar.setBackgroundColor({
          color: dark ? "#0a0a0a" : "#ffffff",
        }).catch(() => {});
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
      // sign-in completes in the system browser. Establish the session by
      // *fetching* /consume (its Set-Cookie still applies) then navigating the
      // SPA router — NOT a full page load. In remote-URL mode Capacitor only
      // injects the native bridge on the initial WebView load, so a full
      // navigation here would drop it (isNative → false) for the whole session
      // and kill every native feature.
      const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return;
        }
        if (parsed.protocol === "kcals:" && parsed.host === "auth-callback") {
          const code = parsed.searchParams.get("code");
          const from = parsed.searchParams.get("from");
          Browser.close().catch(() => {});
          if (code) {
            // Attach the secret verifier this WebView kept when it started
            // sign-in; /consume only mints a session if it hashes to the code's
            // bound challenge, so an intercepted code alone is useless.
            const params = new URLSearchParams({ code, v: takeVerifier() });
            if (from) params.set("from", from);
            const consumeUrl = `/native/auth/consume?${params.toString()}`;
            const dest = from || "/";
            fetch(consumeUrl, { credentials: "same-origin" })
              .then(() => {
                router.replace(dest);
                router.refresh();
              })
              .catch(() => {
                // Fallback: a full navigation still signs in (the bridge just
                // re-establishes on the next app launch).
                window.location.href = consumeUrl;
              });
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
  }, [router]);

  // Push notifications. Auth is checked client-side (via /api/auth/session) so
  // web/PWA renders don't pay for a session decode just to feed this. When
  // signed out we drop the device's stored token so a shared device stops
  // receiving the previous user's notifications.
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const readToken = () => {
      try {
        return localStorage.getItem(PUSH_TOKEN_KEY) ?? "";
      } catch {
        return "";
      }
    };

    (async () => {
      if (!(await whenNativeReady()) || cancelled) return;
      let authed = false;
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        authed = Boolean((await res.json())?.user);
      } catch {
        // Offline / error — leave push untouched this launch.
        return;
      }
      if (cancelled) return;

      if (!authed) {
        const stale = readToken();
        if (stale) {
          try {
            localStorage.removeItem(PUSH_TOKEN_KEY);
          } catch {}
          fetch("/api/push/unregister", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: stale }),
            keepalive: true,
          }).catch(() => {});
        }
        return;
      }

      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );

      const perm = await PushNotifications.requestPermissions();
      if (cancelled || perm.receive !== "granted") return;

      const regHandle = await PushNotifications.addListener(
        "registration",
        (token) => {
          try {
            localStorage.setItem(PUSH_TOKEN_KEY, token.value);
          } catch {}
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
  }, []);

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
