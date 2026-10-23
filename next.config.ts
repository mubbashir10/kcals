import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Short commit SHA of the live deploy, inlined into the client bundle so a
    // subtle version badge can show exactly which web build is loaded (handy
    // for confirming a deploy actually reached the native WebView).
    NEXT_PUBLIC_BUILD_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  },
  experimental: {
    // Lets us use React's <ViewTransition> for native-feeling page
    // transitions on navigation. See app/layout.tsx + globals.css.
    viewTransition: true,
    // Tree-shakes icon imports so each lucide icon adds ~100 bytes
    // instead of pulling the whole pack.
    optimizePackageImports: ["lucide-react"],
  },
  async rewrites() {
    return [
      // Android Digital Asset Links must live at this exact path, but Next
      // ignores app-router directories that start with a dot, so the handler
      // lives at /well-known/assetlinks and we alias the canonical URL to it.
      {
        source: "/.well-known/assetlinks.json",
        destination: "/well-known/assetlinks",
      },
      // OAuth discovery for AI assistants connecting over MCP. `:path*` also
      // catches the path-suffixed forms (…/oauth-protected-resource/api/mcp)
      // that RFC 9728/8414 clients try first.
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/well-known/oauth-protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/well-known/oauth-authorization-server",
      },
    ];
  },
  async headers() {
    return [
      // Service worker must never be cached by the browser — otherwise
      // bugfixes in sw.js take days to roll out to returning users.
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      // The MCP endpoint and its OAuth machinery can be called from a
      // browser-based assistant. Bearer tokens aren't ambient credentials, so
      // a wildcard origin is safe; Authorization has to be named because `*`
      // doesn't cover it. Set here once, so Next's own OPTIONS replies and
      // error responses carry it too.
      ...[
        "/api/mcp",
        "/api/oauth/:path*",
        "/.well-known/oauth-protected-resource/:path*",
        "/.well-known/oauth-authorization-server/:path*",
      ].map((source) => ({
        source,
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, *" },
          { key: "Access-Control-Expose-Headers", value: "WWW-Authenticate, *" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      })),
      // The OAuth consent screen must never render inside someone else's
      // frame, or a page could overlay it and steal the click on Allow.
      {
        source: "/oauth/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
