// KILL-SWITCH service worker.
//
// The previous caching service worker was serving a stale app shell inside the
// Capacitor native WebView — which both (a) stopped new deploys from reaching
// the app and (b) bypassed Capacitor's native-bridge injection, so
// `isNative()` stayed false and every native feature was off.
//
// This version caches NOTHING. On activate it deletes every cache and
// unregisters itself, so every request goes straight to the network and the
// native bridge loads normally. Once things are healthy we can reintroduce a
// caching SW that is network-first for navigations and truly no-ops on native.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
      await self.clients.claim();
    })()
  );
});

// No fetch handler on purpose — nothing is intercepted or served from cache.
