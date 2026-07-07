import type { CapacitorConfig } from "@capacitor/cli";

// kcals is a full-stack Next.js app (server components, server actions,
// next-auth middleware, per-request Prisma) — it can't be statically
// exported. So Capacitor runs in REMOTE-URL mode: the native WebView loads
// the live production site and we bolt native plugins on top. Content still
// auto-updates on every Vercel deploy, exactly like the old TWA, but now
// with a real native bridge (status bar, splash, back button, haptics,
// share, push, deep-linked OAuth handoff, …).
//
// `webDir` is only a fallback Capacitor requires to exist; while `server.url`
// is set it's essentially unused (shown only if the site is unreachable on
// first launch). See README.md for the full architecture.
const config: CapacitorConfig = {
  appId: "app.kcals",
  appName: "kcals",
  webDir: "www",
  server: {
    url: "https://kcals.app",
    androidScheme: "https",
    // The WebView itself only ever navigates within kcals.app; external
    // links are intercepted and opened in the system browser by the
    // web-side native bridge (src/components/native/native-bridge.tsx).
    allowNavigation: ["kcals.app"],
  },
  android: {
    // The app paints its own near-black background; match it so there's no
    // white flash between the splash and first paint.
    backgroundColor: "#0a0a0a",
  },
  plugins: {
    SplashScreen: {
      // Hidden manually from the bridge once the WebView has painted, so the
      // splash never vanishes to a blank screen mid-load.
      launchAutoHide: false,
      backgroundColor: "#0a0a0a",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
