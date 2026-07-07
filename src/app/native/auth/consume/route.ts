import { NextResponse, type NextRequest } from "next/server";
import { encode } from "next-auth/jwt";

import { db } from "@/lib/db";

// Reached inside the native WebView (the bridge navigates here on the
// kcals://auth-callback deep link). We validate the one-time code minted by
// /native/auth/finish and establish a session *in the WebView's cookie jar* by
// hand-minting the same JWT session cookie Auth.js would. Because sessions are
// JWT (see src/auth.config.ts), no DB session row is needed — we just encode a
// token whose shape matches the jwt/session callbacks and set it under the
// exact cookie name (and salt) Auth.js reads.
export const dynamic = "force-dynamic";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days — Auth.js default.

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const bounce = NextResponse.redirect(new URL("/signin", origin));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return bounce;

  // Fetch + burn the code in one atomic step — delete throws if it's already
  // gone, so a code can never be consumed twice — and pull the user along.
  const row = await db.nativeAuthCode
    .delete({ where: { code }, include: { user: true } })
    .catch(() => null);
  if (!row || row.expiresAt.getTime() < Date.now()) return bounce;
  const user = row.user;

  // Auth.js prefixes the cookie with __Secure- and sets `secure` on HTTPS.
  // The prefix is also the JWT encryption salt, so it must match exactly for
  // auth()/middleware to decode the token we mint here.
  const secureCookies = (
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol
  ).includes("https");
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

  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(cookieName, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
