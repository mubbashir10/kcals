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
  // (manifest + icons must be fetchable from the signin page itself so the
  // browser can show the install prompt before the user logs in).
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon|apple-icon|logo.svg|manifest.webmanifest|sw.js|opengraph-image|twitter-image|robots.txt|sitemap.xml).*)",
  ],
};
