import { type NextRequest } from "next/server";

import { signIn } from "@/auth";

// Entry point for native sign-in, opened in the SYSTEM browser by the native
// bridge (Google blocks OAuth inside embedded WebViews). We carry the client's
// PKCE-style challenge (`ch`) and optional post-login destination (`from`)
// through to /native/auth/finish via the OAuth callbackUrl, so the session can
// only be redeemed by the WebView that holds the matching verifier.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ch = req.nextUrl.searchParams.get("ch") ?? "";
  const from = req.nextUrl.searchParams.get("from") ?? "";

  const finish = new URLSearchParams({ ch });
  if (from) finish.set("from", from);

  // signIn throws a NEXT_REDIRECT to Google; on success Auth.js redirects to
  // this (same-origin) callbackUrl, preserving its query string.
  await signIn("google", {
    redirectTo: `/native/auth/finish?${finish.toString()}`,
  });
}
