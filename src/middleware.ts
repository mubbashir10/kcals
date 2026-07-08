import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/auth.config";

// Edge runtime — uses the lightweight config (no Prisma).
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/signin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    const signInUrl = new URL("/signin", req.nextUrl);
    if (pathname !== "/") signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Exclude paths that should be reachable without auth: Next internals,
  // static assets, the auth API, social-card metadata files (Slack /
  // Twitter / iMessage crawlers can't sign in), and PWA install assets
  // (manifest + icons + screenshots must be fetchable from the signin page
  // itself so the browser can show the install prompt before the user logs
  // in). `\.well-known` covers the Android Digital Asset Links check, which
  // Chrome fetches unauthenticated to verify a TWA — redirecting it to
  // /signin would silently break full-screen APK verification. Prefix tokens
  // cover their whole family so the manifest and this list can't drift:
  // `screenshot-` matches every form factor, `icon` matches `icon-maskable`.
  // `native/auth` covers the Capacitor OAuth handoff: /start and /finish run
  // in the system browser and /consume runs in the WebView before its session
  // cookie exists, so none of them can sit behind the auth redirect.
  matcher: [
    "/((?!api/auth|native/auth/|_next/static|_next/image|favicon.ico|icon|apple-icon|logo.svg|manifest.webmanifest|screenshot-|\\.well-known|sw.js|opengraph-image|twitter-image|robots.txt|sitemap.xml).*)",
  ],
};
