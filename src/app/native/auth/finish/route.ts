import { randomBytes } from "crypto";

import { NextResponse, after, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getSiteUrl } from "@/lib/site";

// Reached in the system browser right after Google OAuth succeeds. The browser
// now holds a session, but that's the browser's cookie jar — not the app's
// WebView. So we mint a short-lived, single-use code bound to the client's
// challenge and deep-link back into the app with it; the app exchanges it (with
// its secret verifier) at /native/auth/consume to establish its own session.
export const dynamic = "force-dynamic";

const CODE_TTL_MS = 60_000; // 60s — just long enough to bounce back into the app.

export async function GET(req: NextRequest) {
  const signin = `${getSiteUrl()}/signin`;

  const session = await auth();
  // No session (shouldn't happen post-OAuth) or no challenge to bind the code
  // to → fail closed rather than mint an unbound bearer credential.
  const challenge = req.nextUrl.searchParams.get("ch");
  if (!session?.user?.id || !challenge) {
    return NextResponse.redirect(signin);
  }
  const from = req.nextUrl.searchParams.get("from") ?? "";

  const code = randomBytes(32).toString("base64url");
  await db.nativeAuthCode.create({
    data: {
      code,
      userId: session.user.id,
      challenge,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });
  // Prune expired codes after the response so abandoned flows can't accumulate;
  // after() keeps the function alive for it (a floating promise can be dropped).
  after(() =>
    db.nativeAuthCode
      .deleteMany({ where: { expiresAt: { lt: new Date() } } })
      .then(() => {})
      .catch(() => {})
  );

  // base64url code is [A-Za-z0-9-_]; from is percent-encoded — both safe to
  // interpolate into the href and the JS string below.
  const deepLink =
    `kcals://auth-callback?code=${code}` +
    (from ? `&from=${encodeURIComponent(from)}` : "");

  // Auto-hand back to the app, with a manual button in case the browser blocks
  // the automatic app-scheme launch (some browsers require a tap).
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to kcals…</title>
    <style>
      html,body{height:100%;margin:0;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif}
      .wrap{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.25rem;text-align:center;padding:2rem}
      .brand{font-size:2rem;font-weight:600;letter-spacing:-.02em;background:linear-gradient(to bottom,#a3e635,#10b981);-webkit-background-clip:text;background-clip:text;color:transparent}
      p{opacity:.6;font-size:.9rem;max-width:20rem;line-height:1.5}
      .btn{display:inline-block;padding:.7rem 1.4rem;border-radius:999px;background:#10b981;color:#04120c;font-weight:600;text-decoration:none}
    </style>
    <script>window.location.replace(${JSON.stringify(deepLink)});</script>
  </head>
  <body>
    <div class="wrap">
      <div class="brand">kcals</div>
      <p>Signed in! Returning to the app…</p>
      <a class="btn" href="${deepLink}">Open kcals</a>
    </div>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
