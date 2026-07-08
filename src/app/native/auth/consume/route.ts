import { createHash, timingSafeEqual } from "crypto";

import { NextResponse, type NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

import { db } from "@/lib/db";

// Reached inside the native WebView (the bridge navigates here on the
// kcals://auth-callback deep link, adding the secret verifier it kept). We
// validate the one-time code AND that the caller holds the verifier whose hash
// was bound to it at /native/auth/finish — so a code intercepted by another app
// or planted for session-fixation can't be redeemed here. Then we establish a
// session in the WebView's cookie jar by hand-minting the same JWT session
// cookie Auth.js would (sessions are JWT — see src/auth.config.ts).
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days — Auth.js default.

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const bounce = NextResponse.redirect(new URL("/signin", origin));

  const code = req.nextUrl.searchParams.get("code");
  const verifier = req.nextUrl.searchParams.get("v") ?? "";
  if (!code) return bounce;

  // Fetch + burn the code in one atomic step — delete throws if it's already
  // gone, so a code can never be consumed twice — and pull the user along.
  const row = await db.nativeAuthCode
    .delete({ where: { code }, include: { user: true } })
    .catch(() => null);
  if (!row || row.expiresAt.getTime() < Date.now()) return bounce;

  // Proof-of-possession: the presented verifier must hash to the bound
  // challenge. Constant-time compare over fixed-length base64url digests.
  const expected = createHash("sha256").update(verifier).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(row.challenge);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return bounce;

  const user = row.user;

  // Auth.js prefixes the cookie with __Secure- and sets `secure` on HTTPS. The
  // prefix is also the JWT encryption salt, so it must match exactly for
  // auth()/middleware to decode. Force secure in production (kcals.app is
  // always HTTPS) so a proxy that drops x-forwarded-proto can't pick the wrong
  // name and lock the user into a sign-in loop.
  const secureCookies =
    (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol).includes(
      "https"
    ) || process.env.NODE_ENV === "production";
  const cookieName = secureCookies
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const token = await encode({
    // Mirror the token the Google sign-in would produce: the jwt callback sets
    // `uid`, and Auth.js hydrates session.user from sub/name/email/picture.
    token: {
      sub: user.id,
      uid: user.id,
      name: user.name,
      email: user.email,
      picture: user.image,
    },
    secret: process.env.AUTH_SECRET!,
    salt: cookieName,
    maxAge: SESSION_MAX_AGE,
  });

  // Return to the intended destination (same-origin path only), default home.
  const fromParam = req.nextUrl.searchParams.get("from") ?? "";
  const dest =
    fromParam.startsWith("/") && !fromParam.startsWith("//") ? fromParam : "/";

  const res = NextResponse.redirect(new URL(dest, origin));
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
