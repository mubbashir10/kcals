import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
