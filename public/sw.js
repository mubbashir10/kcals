// Bump VERSION on shape changes (new caching rules, fixed bugs). The old
// caches are deleted in `activate`, which forces a clean slate for clients.
const VERSION = "v1";
const STATIC_CACHE = `kcals-static-${VERSION}`;
const PAGES_CACHE = `kcals-pages-${VERSION}`;

const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE];

self.addEventListener("install", () => {
  // Take over from any previous SW as soon as we're installed — otherwise
  // a returning user keeps running the old worker until every tab closes.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("kcals-") && !ALL_CACHES.includes(n))
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// Routing — every fetch goes through here.
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only same-origin GETs are cacheable. Server actions are POSTs and
  // external requests (USDA, Open Food Facts, fonts CDN) should pass through.
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept auth — we don't want to serve stale session state.
  if (url.pathname.startsWith("/api/auth")) return;

  // Hashed static bundles are immutable: cache forever.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  // Dynamic image generation routes (Next image, og, icon).
  if (
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(staleWhileRevalidate(req, STATIC_CACHE));
    return;
  }

  // Pages + RSC payloads — both are GETs to the same URL, differentiated by
  // headers. Stale-while-revalidate gives the user an instant render while
  // we refresh in the background.
  const isPage =
    req.mode === "navigate" ||
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Router-Prefetch") === "1" ||
    (req.destination === "" && req.headers.get("Accept")?.includes("text/x-component"));

  if (isPage) {
    event.respondWith(staleWhileRevalidatePage(req, PAGES_CACHE));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

// Pages need extra care:
//  • RSC requests vary by the `RSC` / `Next-Router-State-Tree` headers, so the
//    cache key has to include them — otherwise an HTML response could be
//    returned for an RSC request (or vice versa) and React crashes.
//  • Auth redirects (302 → /signin) must not be cached or we'd lock signed-out
//    users out of ever seeing their content.
async function staleWhileRevalidatePage(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cacheKey = buildPageCacheKey(req);
  const cached = await cache.match(cacheKey);

  const network = fetch(req)
    .then((res) => {
      // Don't cache redirects, errors, or anything Next marked uncacheable.
      const cacheControl = res.headers.get("Cache-Control") || "";
      if (
        res.ok &&
        res.type === "basic" &&
        !cacheControl.includes("no-store")
      ) {
        cache.put(cacheKey, res.clone());
      }
      return res;
    })
    .catch(() => cached);

  return cached || network;
}

function buildPageCacheKey(req) {
  // Differentiate RSC vs. full-page responses for the same URL.
  const isRsc = req.headers.get("RSC") === "1";
  const url = new URL(req.url);
  if (isRsc) url.searchParams.set("__sw_rsc", "1");
  return new Request(url.toString(), { method: "GET" });
}

// Allow the client to nuke caches on sign-out so the next user doesn't see
// the previous user's data. Triggered via postMessage({ type: 'CLEAR_PAGES' }).
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_PAGES") {
    event.waitUntil(caches.delete(PAGES_CACHE));
  }
});
