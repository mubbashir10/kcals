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
    ];
  },
};

export default nextConfig;
